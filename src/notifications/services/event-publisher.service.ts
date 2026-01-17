import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { BackoffOptions, JobsOptions, KeepJobs, Queue } from 'bullmq';
import { SECOND } from '@/constants';
import { ContextService } from '@/infra/logger/services/context.service';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import type { BaseEvent } from '../events/base-event.dto';
import {
  EVENT_CONSTANTS,
  type EventMap,
  type EventType,
} from '../events/events';

export interface PublishOptions extends JobsOptions {
  userId?: string;
  /** Whether to emit the event to admin users via WebSocket */
  emitToAdmins?: boolean;
  /** Optional request ID for tracing */
  requestId?: string;
  /** Queue to publish to - defaults to PUBSUB */
  queue?: (typeof EVENT_CONSTANTS.QUEUES)[keyof typeof EVENT_CONSTANTS.QUEUES];
}

@Injectable()
export class EventPublisherService {
  private readonly queues: Map<string, Queue<BaseEvent<EventType>>>;
  private readonly JOB_FAILURE_DEFAULT_KEEP: KeepJobs = {
    count: 1000, // Keep only the last 1000 successful jobs to save Redis memory
    age: 60 * 60, // Or 1 hour, whichever comes first
  };
  private readonly JOB_DEFAULT_ATTEMPTS = 3;
  private readonly JOB_DEFAULT_BACKOFF: BackoffOptions = {
    type: 'exponential',
    delay: 1 * SECOND,
  };

  constructor(
    @InjectQueue(EVENT_CONSTANTS.QUEUES.NOTIFICATIONS_EVENTS)
    private readonly notificationsEventsQueue: Queue<BaseEvent<EventType>>,
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
  ) {
    this.queues = new Map([
      [
        EVENT_CONSTANTS.QUEUES.NOTIFICATIONS_EVENTS,
        this.notificationsEventsQueue,
      ],
    ]);
  }

  async publishEvent<T extends EventType>(
    eventType: T,
    payload: EventMap[T],
    options?: PublishOptions,
  ): Promise<{ jobId?: string }> {
    try {
      const queueName =
        options?.queue ?? EVENT_CONSTANTS.QUEUES.NOTIFICATIONS_EVENTS;
      const queue = this.queues.get(queueName);

      if (!queue) {
        this.logger.warn('Queue not available, skipping publish', {
          queue: queueName,
        });
        return {};
      }

      const context = this.contextService.getContext();
      const job = await queue.add(
        eventType,
        {
          eventId: randomUUID(),
          timestamp: new Date().toISOString(),
          eventType,
          payload,
          requestId: options?.requestId ?? context.requestId,
          metadata: {
            emitToAdmins: options?.emitToAdmins,
            ...(options?.userId && { userId: options?.userId }),
          },
        },
        {
          priority: options?.priority,
          delay: options?.delay,
          jobId: options?.jobId,
          removeOnComplete: true,
          removeOnFail: options?.removeOnFail ?? this.JOB_FAILURE_DEFAULT_KEEP,
          attempts: options?.attempts ?? this.JOB_DEFAULT_ATTEMPTS,
          backoff: options?.backoff ?? this.JOB_DEFAULT_BACKOFF,
        },
      );

      this.logger.verbose(`Published event: ${eventType}`, {
        eventType,
        jobId: job.id,
        queue: queueName,
      });

      return { jobId: job.id };
    } catch (error) {
      this.logger.error('Failed to publish event to queue', {
        eventType,
        error,
      });
      throw error;
    }
  }
}
