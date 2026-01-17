import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Job, Worker } from 'bullmq';
import { AppConfigService } from '@/config/services/app.config.service';
import { JOB_HANDLER_METADATA } from '@/constants';
import { ContextService } from '@/infra/logger/services/context.service';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import { EventType } from '@/notifications/events/events';
import type { JobHandlerOptions } from '../decorators/job-handler.decorator';
import type { QueueJob } from '../types/queue-job.type';

type JobHandler<T extends EventType = EventType> = (
  job: Job<QueueJob<T>>,
) => Promise<void>;

@Injectable()
export class JobDispatcherService implements OnModuleInit, OnModuleDestroy {
  private workers: Worker[] = [];

  constructor(
    private readonly configService: AppConfigService,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    this.logger.log('Discovering job handlers...');
    const handlersByQueue = this.#discoverHandlers();
    this.logger.log(
      `Found ${handlersByQueue.size} queue(s) with handlers, starting workers...`,
    );
    this.#startWorkers(handlersByQueue);
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down job workers...');
    await Promise.all(this.workers.map(worker => worker.close()));
    this.logger.log('All job workers shut down');
  }

  #discoverHandlers(): Map<string, Map<string, JobHandler>> {
    const queueMap = new Map<string, Map<string, JobHandler>>();

    const providers = this.discoveryService.getProviders();
    const controllers = this.discoveryService.getControllers();

    const allInstances = [...providers, ...controllers].filter(
      wrapper => wrapper.instance && !wrapper.isAlias,
    );

    for (const { instance } of allInstances) {
      const prototype = Object.getPrototypeOf(instance);
      const allMethodNames = this.metadataScanner.getAllMethodNames(prototype);

      for (const methodName of allMethodNames) {
        const method = prototype[methodName];
        const metadata = this.reflector.get<JobHandlerOptions>(
          JOB_HANDLER_METADATA,
          method,
        );

        if (metadata) {
          let handlers = queueMap.get(metadata.queue);
          if (!handlers) {
            handlers = new Map();
            queueMap.set(metadata.queue, handlers);
          }

          handlers.set(metadata.name, instance[methodName].bind(instance));
          this.logger.verbose(
            `Registered handler for Job: [${metadata.name}] in Queue: [${metadata.queue}]`,
          );
        }
      }
    }

    return queueMap;
  }

  #startWorkers(queueMap: Map<string, Map<string, JobHandler>>) {
    const redisConfig = this.configService.getOrThrow('redis');

    for (const [queueName, handlers] of queueMap) {
      const worker = new Worker(
        queueName,
        async (job: Job) => {
          const handler = handlers.get(job.name);
          if (!handler) {
            throw new Error(
              `No handler found for job "${job.name}" in queue "${queueName}"`,
            );
          }

          // Wrap handler execution in context for proper logging
          return this.contextService.runWithContext(
            {
              ...this.contextService.getContext(),
              flow: 'bullmq',
              context: 'JobDispatcher',
              queue: queueName,
              jobName: job.name,
              jobId: job.id,

              ...(job.data?.requestId && { requestId: job.data.requestId }),
              ...(job.data?.metadata?.userId && {
                userId: job.data.metadata.userId,
              }),
            },
            async () => {
              const message = `Processing job ${job.name} (ID: ${job.id}) from queue ${queueName}, handler: ${handler.name}`;
              this.logger.verbose(message);
              await job.log(message);
              try {
                await handler(job);
                // Log completion BEFORE the job is technically "finished" in Redis
                await job.log(
                  `Handler execution completed successfully for job ${job.id}`,
                );
              } catch (error) {
                // Log error details to dashboard before throwing
                await job.log(
                  `Handler failed for job ${job.id}: ${error instanceof Error ? error.message : error}, stack: ${error instanceof Error ? error.stack : 'unknown'}`,
                );
                throw error;
              }
            },
          );
        },
        {
          connection: {
            host: redisConfig.host,
            port: redisConfig.port,
            ...(redisConfig.password && { password: redisConfig.password }),
            db: redisConfig.db,
          },
          concurrency: redisConfig.queues.concurrency,
          limiter: {
            max: redisConfig.queues.rateLimitMax,
            duration: redisConfig.queues.rateLimitDuration,
          },
        },
      );

      // Add event listeners for worker lifecycle
      worker.on('completed', job => {
        this.logger.verbose(
          `Job completed: ${job.id} for event type: ${job.data?.eventType}`,
          {
            jobId: job.id,
            eventType: job.data?.eventType,
            duration:
              job.finishedOn && job.processedOn
                ? job.finishedOn - job.processedOn
                : 0,
          },
        );
      });

      worker.on('failed', (job, error) => {
        this.logger.error(
          job
            ? `Job failed: ${job.id} for event type: ${job.data?.eventType}`
            : 'Job failed',
          {
            jobId: job?.id,
            eventType: job?.data?.eventType,
            error,
            attempt: job?.attemptsMade,
            maxAttempts: job?.opts.attempts,
          },
        );
      });

      worker.on('error', error => {
        this.logger.error('Worker error', { error, queueName });
      });

      this.workers.push(worker);
      this.logger.log(
        `Started worker for queue: ${queueName} with ${handlers.size} handlers`,
        {
          handlers: Array.from(handlers.keys()).join(', '),
        },
      );
    }
  }
}
