import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { ContextService } from '@/logger/services/context.service';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { EventMap, EventType } from '@/notifications/events/events';
import type { BaseEvent } from '../../notifications/events/base-event.dto';
import { REDIS_STREAMS_CLIENT } from './stream.constants';

export interface PublishOptions {
  userId?: string;
  emitToAdmins?: boolean;
}

/**
 * Service for publishing events to Redis Streams.
 * Provides guaranteed delivery with persistence, unlike pub/sub.
 */
@Injectable()
export class StreamPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly streamName = 'events:notifications';

  constructor(
    @Optional()
    @Inject(REDIS_STREAMS_CLIENT)
    private readonly redis: Redis | undefined,
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    if (this.redis) {
      try {
        await this.redis.ping();
        this.logger.log('StreamPublisherService connected to Redis');
      } catch (error) {
        this.logger.error('Failed to connect StreamPublisherService to Redis', {
          error,
        });
      }
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  /**
   * Publishes a typed event to Redis Streams.
   * If Redis Streams is not enabled, logs a warning and returns.
   */
  async publishEvent<T extends EventType>(
    eventType: T,
    payload: EventMap[T],
    options?: PublishOptions,
  ): Promise<void> {
    if (!this.redis) {
      this.logger.warn(
        'Redis Streams not enabled, event not published. Set REDIS_HOST and REDIS_STREAMS_ENABLED=true to enable.',
        { eventType },
      );
      return;
    }

    const context = this.contextService.getContext();
    const event: BaseEvent<T> = {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      eventType,
      payload,
      metadata: options,
    };

    this.logger.verbose(`Publishing event to stream: ${eventType}`, {
      eventId: event.eventId,
      eventType,
      streamName: this.streamName,
    });

    try {
      // XADD key [MAXLEN ~ count] * field value [field value ...]
      // The '*' means Redis generates the ID automatically
      // MAXLEN ~ 10000 keeps stream trimmed to ~10k messages (approximate trimming for performance)
      const messageId = await this.redis.xadd(
        this.streamName,
        'MAXLEN',
        '~',
        10000,
        '*',
        'event',
        JSON.stringify(event),
      );

      this.logger.verbose(`Event published to stream with ID: ${messageId}`, {
        eventId: event.eventId,
        eventType,
        messageId,
      });
    } catch (error) {
      this.logger.error('Failed to publish event to stream', {
        eventId: event.eventId,
        eventType,
        error,
      });
      throw error;
    }
  }
}
