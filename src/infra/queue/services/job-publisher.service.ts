import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ContextLogger, ContextService } from '@arkv/nestjs-context-logger';
import {
  EVENTS,
  type EventMap,
  type EventType,
  type QueueType,
} from '@/notifications/events/events';
import { JobDispatcherService } from './job-dispatcher.service';

export interface PublishOptions {
  userId?: string;
  /** Whether to emit the event to admin users via WebSocket */
  emitToAdmins?: boolean;
  /** Optional request ID for tracing */
  requestId?: string;
  /** Queue to publish to - defaults to NOTIFICATIONS_EVENTS */
  queue?: QueueType;
  /** Job priority (higher = processed sooner) */
  priority?: number;
  /** Delay in ms before the job becomes processable */
  delay?: number;
  /** Explicit job id (also used for deduplication) */
  jobId?: string;
}

@Injectable()
export class JobPublisherService {
  constructor(
    private readonly dispatcher: JobDispatcherService,
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
  ) {}

  async publishJob<T extends EventType>(
    eventType: T,
    payload: EventMap[T],
    options?: PublishOptions,
  ): Promise<{ jobId?: string }> {
    try {
      const queueName = options?.queue ?? EVENTS.QUEUES.NOTIFICATIONS_EVENTS;
      const queue = this.dispatcher.getQueue(queueName);
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
