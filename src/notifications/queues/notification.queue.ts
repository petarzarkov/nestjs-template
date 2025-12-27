import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@/logger/services/context-logger.service';
import type { EventMap } from '../events/events';

export type NotificationJob<T extends keyof EventMap = keyof EventMap> = {
  eventType: T;
  payload: EventMap[T];
  metadata?: {
    userId?: string;
    emitToAdmins?: boolean;
    requestId?: string;
  };
};

/**
 * BullMQ queue for notification jobs.
 * Handles job enqueueing with retry, priority, and delay support.
 */
@Injectable()
export class NotificationQueue implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue<NotificationJob>;

  constructor(
    private readonly configService: AppConfigService<ValidatedConfig>,
    private readonly logger: ContextLogger,
  ) {}

  async onModuleInit() {
    const redisConfig = this.configService.get('redis');
    if (!redisConfig?.queues.enabled) {
      this.logger.log('Redis queues not enabled, NotificationQueue disabled');
      return;
    }

    this.queue = new Queue<NotificationJob>('notifications', {
      connection: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
      },
      defaultJobOptions: {
        attempts: redisConfig.queues.maxRetries,
        backoff: {
          type: 'exponential',
          delay: redisConfig.queues.retryDelayMs,
        },
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
          age: 86400, // 24 hours
        },
        removeOnFail: {
          count: 500, // Keep last 500 failed jobs
          age: 604800, // 7 days
        },
      },
    });

    this.logger.log('Notification queue initialized');
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
      this.logger.log('Notification queue closed');
    }
  }

  /**
   * Add a notification job to the queue
   */
  async addJob<T extends keyof EventMap>(
    eventType: T,
    payload: EventMap[T],
    options?: {
      userId?: string;
      emitToAdmins?: boolean;
      requestId?: string;
      priority?: number; // 1 (highest) to 100 (lowest)
      delay?: number; // Delay in ms
    },
  ) {
    if (!this.queue) {
      this.logger.warn('Queue not initialized, skipping job', { eventType });
      return null;
    }

    const job = await this.queue.add(
      eventType,
      {
        eventType,
        payload,
        metadata: {
          userId: options?.userId,
          emitToAdmins: options?.emitToAdmins,
          requestId: options?.requestId,
        },
      },
      {
        priority: options?.priority,
        delay: options?.delay,
      },
    );

    this.logger.verbose(
      `Job enqueued: ${job.id} for event type: ${eventType}`,
      {
        eventType,
        jobId: job.id,
      },
    );

    return job;
  }

  getQueue(): Queue<NotificationJob> | undefined {
    return this.queue;
  }
}
