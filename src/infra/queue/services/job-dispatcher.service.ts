import { join } from 'node:path';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Job, Worker } from 'bullmq';
import { AppConfigService } from '@/config/services/app.config.service';
import { JOB_HANDLER_METADATA, MINUTE, SECOND } from '@/constants';
import { ContextService } from '@/infra/logger/services/context.service';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import type { JobHandlerOptions } from '@/infra/queue/decorators/job-handler.decorator';
import type { JobHandlerType } from '@/infra/queue/types/queue-job.type';
import { EVENTS } from '@/notifications/events/events';

@Injectable()
export class JobDispatcherService implements OnModuleInit, OnModuleDestroy {
  private workers: Worker[] = [];
  private handlersCache: Map<string, Map<string, JobHandlerType>> | null = null;

  constructor(
    private readonly configService: AppConfigService,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    if (process.env.IS_JOB_WORKER === 'true') {
      return;
    }
    this.handlersCache = this.#discoverHandlers(() => true);
    this.#startWorkers(this.handlersCache);
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down job workers...');
    await Promise.all(this.workers.map(worker => worker.close()));
    this.logger.log('All job workers shut down');
  }

  /**
   * Wraps handler execution with a timeout to prevent jobs from hanging indefinitely.
   * If the handler exceeds the timeout, the job will be failed with a timeout error.
   */
  private async runWithTimeout(
    job: Job,
    handler: JobHandlerType,
    timeoutMs: number,
  ): Promise<unknown> {
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Job execution timed out after ${timeoutMs / 1000}s. Job may be hanging on external API call or database operation.`,
          ),
        );
      }, timeoutMs);
    });

    try {
      return await Promise.race([handler(job), timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  #discoverHandlers(
    queueFilter: (queue: string) => boolean = () => true,
  ): Map<string, Map<string, JobHandlerType>> {
    const queueMap = new Map<string, Map<string, JobHandlerType>>();
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
          if (!queueFilter(metadata.queue)) continue;

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

  #startWorkers(queueMap: Map<string, Map<string, JobHandlerType>>) {
    const redisConfig = this.configService.getOrThrow('redis');
    const extension = __filename.endsWith('.ts') ? 'ts' : 'js';
    const processorPath = join(__dirname, `../job.processor.${extension}`);

    for (const [queueName, handlers] of queueMap) {
      const isBackgroundJob = queueName === EVENTS.QUEUES.BACKGROUND_JOBS;
      const processor = isBackgroundJob
        ? processorPath
        : async (job: Job) => {
            const handler = handlers.get(job.name);
            if (!handler) {
              throw new Error(
                `No handler found for job "${job.name}" in queue "${queueName}"`,
              );
            }

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
                const message = `Processing job ${job.name} (ID: ${job.id})`;
                this.logger.verbose(message);

                try {
                  await this.runWithTimeout(
                    job,
                    handler,
                    redisConfig.queues.jobTimeoutMs,
                  );
                } catch (error) {
                  await job.log(
                    `Failed: ${error instanceof Error ? error.message : error}`,
                  );
                  throw error;
                }
              },
            );
          };

      const worker = new Worker(queueName, processor, {
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
        lockDuration: 1 * MINUTE,
        stalledInterval: 30 * SECOND,
        maxStalledCount: 2,
      });

      worker.on('completed', job => {
        this.logger.verbose(`Job completed: ${this.getJobId(job)}`);
      });

      worker.on('failed', (job, error) => {
        this.logger.error(`Job failed: ${this.getJobId(job)}`, { error });
      });

      worker.on('error', error => {
        this.logger.error('Worker error', { error, queueName });
      });

      this.workers.push(worker);
      this.logger.log(
        `Started [${isBackgroundJob ? 'background' : 'foreground'}] worker for queue: ${queueName}`,
        {
          queueName,
          handlers: Array.from(handlers.entries())
            .map(
              ([name, handler]) =>
                `${name}: ${handler?.name?.replace('bound ', '')}`,
            )
            .join(', '),
          worker: {
            id: worker.id,
            concurrency: worker.concurrency,
          },
        },
      );
    }
  }

  getJobId(job: Job | undefined) {
    if (!job) return 'Unknown job';
    return `${job.id} ${job.queueName}[${job.name}]`;
  }

  public async executeBackgroundJob(job: Job) {
    if (!this.handlersCache) {
      this.handlersCache = this.#discoverHandlers(
        queue => queue === EVENTS.QUEUES.BACKGROUND_JOBS,
      );
    }

    const handlers = this.handlersCache.get(job.queueName);
    const handler = handlers?.get(job.name);

    if (!handler) {
      throw new Error(
        `Handler not found for job '${job.name}' in queue '${job.queueName}' (Background Process)`,
      );
    }

    const redisConfig = this.configService.getOrThrow('redis');
    return this.runWithTimeout(job, handler, redisConfig.queues.jobTimeoutMs);
  }
}
