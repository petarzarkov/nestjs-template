import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Job } from 'bullmq';
import { AppModule } from '@/app.module';
import { ContextLogger } from '../logger/services/context-logger.service';
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
    app = await NestFactory.createApplicationContext(AppModule, {
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
  }

  const logger = app.get(ContextLogger);

  app.useLogger(logger);
  const jobDispatcher = app.get(JobDispatcherService);
  await job.log(
    `Started Background Job Processor: ${jobDispatcher.getJobId(job)}`,
  );
  try {
    const result = await jobDispatcher.executeBackgroundJob(job);
    await job.log(
      `Background Job processed successfully: ${jobDispatcher.getJobId(job)}`,
    );
    return result;
  } catch (error) {
    logger.error(
      `Failed to process Background Job: ${jobDispatcher.getJobId(job)}`,
      {
        job,
        error,
      },
    );
    await job.log(
      `Failed to process job ${jobDispatcher.getJobId(job)}: ${error instanceof Error ? error.message : error}, stack: ${error instanceof Error ? error.stack : 'unknown'}`,
    );
    throw error;
  }
}
