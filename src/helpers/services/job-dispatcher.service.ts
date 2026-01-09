import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Job, Worker } from 'bullmq';
import { JOB_HANDLER_METADATA } from '@/config/constants';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { JobHandlerOptions } from '@/core/decorators/job-handler.decorator';
import { EventType } from '@/notifications/events/events';
import { NotificationJob } from '@/notifications/types/notification-job';

type JobHandler<T extends EventType = EventType> = (
  job: Job<NotificationJob<T>>,
) => Promise<void>;

@Injectable()
export class JobDispatcherService implements OnModuleInit, OnModuleDestroy {
  private workers: Worker[] = [];

  constructor(
    private readonly configService: AppConfigService<ValidatedConfig>,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  async onModuleInit() {
    const handlersByQueue = this.#discoverHandlers();
    console.log('handlersByQueue', handlersByQueue);
    this.#startWorkers(handlersByQueue);
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map(worker => worker.close()));
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
        (job: Job) => {
          const handler = handlers.get(job.name);

          if (!handler) {
            throw new Error(
              `No handler found for job "${job.name}" in queue "${queueName}"`,
            );
          }

          return handler(job);
        },
        {
          connection: {
            host: redisConfig.host,
            port: redisConfig.port,
          },
        },
      );

      this.workers.push(worker);
    }
  }
}
