import { join } from 'node:path';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Job, Worker } from 'bullmq';
import { AppConfigService } from '@/config/services/app.config.service';
import { JOB_HANDLER_METADATA } from '@/constants';
import { ContextService } from '@/infra/logger/services/context.service';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import { EVENT_CONSTANTS } from '@/notifications/events/events';
import type { JobHandlerOptions } from '../decorators/job-handler.decorator';
import type { JobHandlerType } from '../types/queue-job.type';

@Injectable()
export class JobDispatcherService implements OnModuleInit, OnModuleDestroy {
  private workers: Worker[] = [];
  // Cache handlers so we don't scan metadata multiple times
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
    // If we are in the Worker Process, do nothing during init.
    // The entry point for the worker is 'executeJob', not onModuleInit.
    if (process.env.IS_JOB_WORKER === 'true') {
      return;
    }

    this.logger.log('Discovering job handlers...');

    // Main Process: Discover ALL handlers.
    // We need to know about Background queues to spawn their supervisor Worker,
    // and Foreground queues to run them inline.
    this.handlersCache = this.#discoverHandlers(() => true);

    this.logger.log(
      `Found ${this.handlersCache.size} queue(s) with handlers, starting workers...`,
    );

    this.#startWorkers(this.handlersCache);
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down job workers...');
    await Promise.all(this.workers.map(worker => worker.close()));
    this.logger.log('All job workers shut down');
  }

  /**
   * Scans the app for methods decorated with @JobHandler
   * @param queueFilter Optional predicate to filter which queues to register
   */
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
          // FILTERING: Skip queues that don't match our criteria
          if (!queueFilter(metadata.queue)) {
            continue;
          }

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
      const isBackgroundJob =
        queueName === EVENT_CONSTANTS.QUEUES.BACKGROUND_JOBS;

      // STRATEGY SELECTION:
      // If Background Queue -> Use File Path (Sandboxed Process)
      // If Foreground Queue -> Use Inline Callback (Shared Process)
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
                  await handler(job);
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
      );
    }
  }

  getJobId(job: Job | undefined) {
    if (!job) {
      return 'Unknown job';
    }
    return `${job.id} ${job.queueName}[${job.name}]`;
  }

  /**
   * This method is called by the Sandboxed Processor (in the child process).
   */
  public async executeBackgroundJob(job: Job) {
    // Lazy discovery inside the worker process
    if (!this.handlersCache) {
      // When running as a worker, we ONLY care about the Background Queue handlers.
      // We can filter out everything else to keep the memory footprint cleaner.
      this.handlersCache = this.#discoverHandlers(
        queue => queue === EVENT_CONSTANTS.QUEUES.BACKGROUND_JOBS,
      );
    }

    const handlers = this.handlersCache.get(job.queueName);
    const handler = handlers?.get(job.name);

    if (!handler) {
      throw new Error(
        `Handler not found for job '${job.name}' in queue '${job.queueName}' (Background Process)`,
      );
    }

    return handler(job);
  }
}
