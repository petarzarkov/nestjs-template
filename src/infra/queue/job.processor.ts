import { NestFactory } from '@nestjs/core';
import { Job } from 'bullmq';
import { AppModule } from '@/app.module';
import pkg from '../../../package.json';
import {
  bootstrapLogger,
  ContextLogger,
} from '../logger/services/context-logger.service';
import { JobDispatcherService } from './services/job-dispatcher.service';

/**
 * This function runs in a completely separate OS process.
 * It bootstraps a fresh NestJS environment for every job.
 */
export default async function jobProcessor(job: Job) {
  process.env.IS_JOB_WORKER = 'true';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: bootstrapLogger(pkg),
    abortOnError: false,
  });

  const logger = app.get(ContextLogger);

  try {
    const jobDispatcher = app.get(JobDispatcherService);

    console.log('jobDispatcher', jobDispatcher);
    // TODO: implement job processing
    // const result = await jobDispatcher.processJobInSandbox(job);
    // return result;
  } catch (error) {
    logger.error(`Failed to process job ${job.id}`, {
      job,
      error,
    });
    throw error;
  } finally {
    await app.close();
  }
}
