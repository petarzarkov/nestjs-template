import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';
import { ContextService } from '@/infra/logger/services/context.service';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import type { BaseEvent } from '@/notifications/events/base-event.dto';
import {
  EVENT_CONSTANTS,
  type EventMap,
  type EventType,
  type QueueType,
} from '@/notifications/events/events';

export interface PublishOptions extends JobsOptions {
  userId?: string;
  /** Whether to emit the event to admin users via WebSocket */
  emitToAdmins?: boolean;
  /** Optional request ID for tracing */
  requestId?: string;
  /** Queue to publish to - defaults to PUBSUB */
  queue?: QueueType;
}

@Injectable()
export class JobPublisherService {
  private readonly queues: Map<string, Queue<BaseEvent<EventType>>>;

  constructor(
    @InjectQueue(EVENT_CONSTANTS.QUEUES.NOTIFICATIONS_EVENTS)
    private readonly notificationsEventsQueue: Queue<BaseEvent<EventType>>,
    @InjectQueue(EVENT_CONSTANTS.QUEUES.BACKGROUND_JOBS)
    private readonly backgroundJobsQueue: Queue<BaseEvent<EventType>>,
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
  ) {
    this.queues = new Map([
      [
        EVENT_CONSTANTS.QUEUES.NOTIFICATIONS_EVENTS,
        this.notificationsEventsQueue,
      ],
      [EVENT_CONSTANTS.QUEUES.BACKGROUND_JOBS, this.backgroundJobsQueue],
    ]);
  }

  async publishJob<T extends EventType>(
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
