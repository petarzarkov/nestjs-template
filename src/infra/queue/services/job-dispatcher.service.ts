import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Bunqueue } from 'bunqueue/client';
import type { Job, Processor } from 'bunqueue/client';
import { AppConfigService } from '@/config/services/app.config.service';
import { JOB_HANDLER_METADATA } from '@/constants';
import { ContextLogger, ContextService } from '@arkv/nestjs-context-logger';
import type { JobHandlerOptions } from '@/infra/queue/decorators/job-handler.decorator';
import type {
  JobHandlerType,
  QueueJob,
} from '@/infra/queue/types/queue-job.type';

/**
 * Discovers `@JobHandler` methods and runs each queue as an embedded
 * `bunqueue` instance (SQLite-persisted, in-process — no Redis). Also the
 * enqueue seam used by {@link JobPublisherService}.
 */
@Injectable()
export class JobDispatcherService implements OnModuleInit, OnModuleDestroy {
  readonly #queues = new Map<string, Bunqueue<QueueJob>>();

  constructor(
    private readonly configService: AppConfigService,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
  ) {}

  onModuleInit() {
    const queueConfig = this.configService.getOrThrow('queue');
    // bunqueue's `dataPath` is the SQLite file itself — ensure the dir exists.
    mkdirSync(queueConfig.dataPath, { recursive: true });
    const queueMap = this.#discoverHandlers();

    for (const [queueName, handlers] of queueMap) {
      const routes: Record<string, Processor<QueueJob>> = {};
      for (const [name, handler] of handlers) {
        routes[name] = job => this.#process(queueName, job, handler);
      }

      const queue = new Bunqueue<QueueJob>(queueName, {
        embedded: true,
        dataPath: join(queueConfig.dataPath, `${queueName}.db`),
        routes,
        concurrency: queueConfig.concurrency,
        retry: {
          maxAttempts: queueConfig.maxRetries,
          delay: queueConfig.retryDelayMs,
          strategy: 'exponential',
        },
        limiter: {
          max: queueConfig.rateLimitMax,
          duration: queueConfig.rateLimitDuration,
        },
      });

      queue.on('completed', job =>
        this.logger.verbose(
          `Job completed: ${queueName}[${job.name}] ${job.id}`,
        ),
      );
      queue.on('failed', (job, error) =>
        this.logger.error(`Job failed: ${queueName}[${job.name}] ${job.id}`, {
          error,
        }),
      );
      queue.on('error', error =>
        this.logger.error('Queue error', { error, queueName }),
      );

      this.#queues.set(queueName, queue);
      this.logger.log(`Started bunqueue worker for queue: ${queueName}`, {
        queueName,
        handlers: Array.from(handlers.keys()).join(', '),
        concurrency: queueConfig.concurrency,
      });
    }
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down job queues...');
    await Promise.all([...this.#queues.values()].map(queue => queue.close()));
    this.logger.log('All job queues shut down');
  }

  /** Enqueue seam used by JobPublisherService. */
  getQueue(name: string): Bunqueue<QueueJob> | undefined {
    return this.#queues.get(name);
  }

  /** Names of the queues with registered handlers. */
  getQueueNames(): string[] {
    return [...this.#queues.keys()];
  }

  /** Per-queue job counts (waiting/active/completed/failed/…) for the dashboard. */
  async getStats(): Promise<
    Record<string, Awaited<ReturnType<Bunqueue<QueueJob>['getJobCountsAsync']>>>
  > {
    const entries = await Promise.all(
      [...this.#queues.entries()].map(
        async ([name, queue]) =>
          [name, await queue.getJobCountsAsync()] as const,
      ),
    );
    return Object.fromEntries(entries);
  }

  #process(
    queueName: string,
    job: Job<QueueJob>,
    handler: JobHandlerType,
  ): Promise<unknown> {
    const jobTimeoutMs = this.configService.getOrThrow('queue').jobTimeoutMs;
    return this.contextService.runWithContext(
      {
        ...this.contextService.getContext(),
        flow: 'bunqueue',
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
        this.logger.verbose(`Processing job ${job.name} (ID: ${job.id})`);
        try {
          return await this.#runWithTimeout(job, handler, jobTimeoutMs);
        } catch (error) {
          await job.log(
            `Failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          throw error;
        }
      },
    );
  }

  #runWithTimeout(
    job: Job<QueueJob>,
    handler: JobHandlerType,
    timeoutMs: number,
  ): Promise<unknown> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Job execution timed out after ${timeoutMs / 1000}s. Job may be hanging on an external API call or database operation.`,
          ),
        );
      }, timeoutMs);
    });

    try {
      return Promise.race([handler(job), timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  #discoverHandlers(): Map<string, Map<string, JobHandlerType>> {
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
}
