import { ContextLogger } from '@/logger/services/context-logger.service';
import { ContextService } from '@/logger/services/context.service';
import { EventMap, EventType } from '@/notifications/events/events';
import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { REDIS_EVENT_CLIENT } from '../redis.constants';
import type { BaseEvent } from './base-event.dto';

export interface PublishOptions {
  userId?: string;
  emitToAdmins?: boolean;
}

@Injectable()
export class EventPublisherService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Optional()
    @Inject(REDIS_EVENT_CLIENT)
    private readonly client: ClientProxy | undefined,
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    if (this.client) {
      // Eagerly connect to Redis at startup to avoid lazy connection on first publish
      try {
        await this.client.connect();
        this.logger.log('EventPublisherService connected to Redis');
      } catch (error) {
        this.logger.error('Failed to connect EventPublisherService to Redis', {
          error,
        });
      }
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
    }
  }

  /**
   * Publishes a typed event via Redis pub/sub.
   * If Redis pub/sub is not enabled, logs a warning and returns.
   */
  async publishEvent<T extends EventType>(
    eventType: T,
    payload: EventMap[T],
    options?: PublishOptions,
  ): Promise<void> {
    if (!this.client) {
      this.logger.warn(
        'Redis pub/sub not enabled, event not published. Set REDIS_HOST and REDIS_PUBSUB_ENABLED=true to enable.',
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

    this.logger.verbose(`Publishing event: ${eventType}`, {
      eventId: event.eventId,
      eventType,
    });

    this.client.emit(eventType, event);
  }

  /**
   * Check if Redis pub/sub is enabled.
   */
  isEnabled(): boolean {
    return !!this.client;
  }
}
