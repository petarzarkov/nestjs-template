import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { ContextService } from '@/logger/services/context.service';
import { ContextLogger } from '@/logger/services/context-logger.service';
import {
  EVENT_CONSTANTS,
  type EventMap,
  type EventType,
} from '../events/events';
import type { NotificationJob } from '../types/notification-job';

export interface PublishOptions {
  userId?: string;
  /** Whether to emit the event to admin users via WebSocket */
  emitToAdmins?: boolean;
  /** Optional request ID for tracing */
  requestId?: string;
  /** Job priority (1 = highest, 100 = lowest) */
  priority?: number;
  /** Delay before processing in milliseconds */
  delay?: number;
}

@Injectable()
export class NotificationPublisherService {
  constructor(
    @InjectQueue(EVENT_CONSTANTS.QUEUES.NOTIFICATIONS_EVENTS)
    private readonly notificationQueue: Queue<NotificationJob>,
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
  ) {}

  async publishEvent<T extends EventType>(
    eventType: T,
    payload: EventMap[T],
    options?: PublishOptions,
  ): Promise<{ jobId?: string }> {
    try {
      if (!this.notificationQueue) {
        this.logger.warn('Notification queue not available, skipping publish');
        return {};
      }

      const job = await this.notificationQueue.add(
        eventType,
        {
          eventType,
          payload,
          metadata: {
            emitToAdmins: options?.emitToAdmins,
            ...this.contextService.getContext(),
            ...(options?.userId && { userId: options?.userId }),
            ...(options?.requestId && { requestId: options?.requestId }),
          },
        },
        {
          priority: options?.priority,
          delay: options?.delay,
        },
      );

      this.logger.verbose(`Published event: ${eventType}`, {
        eventType,
        jobId: job.id,
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
