import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Job } from 'bullmq';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import { JobModule } from './job.module';
import { JobDispatcherService } from './services/job-dispatcher.service';

// This persists as long as the child process is alive.
let app: INestApplicationContext | null = null;

/**
 * This function runs in a completely separate OS process.
 * It bootstraps a fresh NestJS environment for every job.
 */
export default async function jobProcessor(job: Job) {
  process.env.IS_JOB_WORKER = 'true';

  if (!app) {
    app = await NestFactory.createApplicationContext(JobModule, {
      logger: ['fatal', 'error', 'warn'],
      abortOnError: false,
    });

    // Handle process termination to close connections gracefully
    // when the parent process tells this worker to die
    process.on('SIGTERM', async () => {
      if (app) {
        await app.close();
      }
    });

    const logger = app.get(ContextLogger);
    app.enableShutdownHooks();
    app.useLogger(logger);

    logger.log(`Job worker initialized, first job: ${job.name} (${job.id})`);
  }

  const logger = app.get(ContextLogger);

  const jobDispatcher = app.get(JobDispatcherService);
  const jobId = jobDispatcher.getJobId(job);
  const startMessage = `Started Background Job Processor: ${jobId}`;
  await job.log(startMessage);
  try {
    const result = await jobDispatcher.executeBackgroundJob(job);
    const successMessage = `Background Job processed successfully: ${jobId}`;
    await job.log(successMessage);
    return result;
  } catch (error) {
    logger.error(`Failed to process Background Job: ${jobId}`, { error });
    await job.log(
      `Failed to process job ${jobDispatcher.getJobId(job)}: ${error instanceof Error ? error.message : error}, stack: ${error instanceof Error ? error.stack : 'unknown'}`,
    );
    throw error;
  }
}
