import { Injectable } from '@nestjs/common';
import { ContextLogger } from '@/logger/services/context-logger.service';
import type { EventMap, EventType } from '../events/events';
import { NotificationQueue } from '../queues/notification.queue';

export interface PublishOptions {
  /** Optional user ID to associate with the event */
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

/**
 * Service for publishing notification events to BullMQ queues.
 * Replaces the old NotificationPublisherService.
 */
@Injectable()
export class NotificationPublisherService {
  constructor(
    private readonly notificationQueue: NotificationQueue,
    private readonly logger: ContextLogger,
  ) {}

  /**
   * Publish an event to the notification queue
   */
  async publishEvent<T extends EventType>(
    eventType: T,
    payload: EventMap[T],
    options?: PublishOptions,
  ): Promise<{ jobId?: string }> {
    try {
      const job = await this.notificationQueue.addJob(eventType, payload, {
        userId: options?.userId,
        emitToAdmins: options?.emitToAdmins,
        requestId: options?.requestId,
        priority: options?.priority,
        delay: options?.delay,
      });

      return { jobId: job?.id };
    } catch (error) {
      this.logger.error('Failed to publish event to queue', {
        eventType,
        error,
      });
      throw error;
    }
  }
}
