import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Redis } from 'ioredis';
import { ValidatedRedisConfig } from '@/config/dto/redis-vars.dto';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { SECOND } from '@/constants';
import { HelpersService } from '@/helpers/services/helpers.service';
import { ContextService } from '@/logger/services/context.service';
import { ContextLogger } from '@/logger/services/context-logger.service';
import type { EventType } from '@/notifications/events/events';
import type { BaseEvent } from '../../notifications/events/base-event.dto';
import { REDIS_STREAMS_CLIENT } from './stream.constants';
import { StreamEventDiscoveryService } from './stream-event-discovery.service';

/**
 * Service that consumes events from Redis Streams and routes them to decorated handlers.
 * Provides:
 * - Consumer groups for load balancing
 * - Automatic retries with configurable backoff
 * - Dead letter queue for failed events
 * - Auto-claiming of stale messages from crashed consumers
 */
@Injectable()
export class StreamConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly streamName = 'events:notifications';
  private readonly deadLetterStreamName = 'events:dead-letter';
  private readonly consumerGroup = 'notifications-handlers';
  private readonly consumerName: string;
  private isRunning = false;
  private consumePromise?: Promise<void>;

  private readonly streamsConfig: ValidatedRedisConfig['streams'];

  constructor(
    @Optional()
    @Inject(REDIS_STREAMS_CLIENT)
    private readonly redis: Redis | undefined,
    private readonly discoveryService: StreamEventDiscoveryService,
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
    private readonly configService: AppConfigService<ValidatedConfig>,
    private readonly helperService: HelpersService,
  ) {
    this.consumerName = `consumer-${this.logger.appId}-${process.pid}`;
    this.streamsConfig = this.configService.get('redis')?.streams ?? {
      enabled: false,
      maxRetries: 3,
      retryDelayMs: SECOND * 5,
      blockTimeMs: 100,
      batchSize: 10,
      autoClaimIdleMs: SECOND * 30,
    };
  }

  async onModuleInit() {
    if (!this.redis) {
      this.logger.log('Redis Streams not enabled, consumer not started');
      return;
    }

    try {
      await this.ensureConsumerGroup();
      await this.startConsuming();
      this.logger.log(
        `StreamConsumerService started with consumer name: ${this.consumerName}`,
        {
          consumerGroup: this.consumerGroup,
          streamName: this.streamName,
          maxRetries: this.streamsConfig.maxRetries,
          retryDelayMs: this.streamsConfig.retryDelayMs,
          blockTimeMs: this.streamsConfig.blockTimeMs,
          batchSize: this.streamsConfig.batchSize,
          autoClaimIdleMs: this.streamsConfig.autoClaimIdleMs,
        },
      );
    } catch (error) {
      this.logger.error('Failed to start StreamConsumerService', { error });
    }
  }

  async onModuleDestroy() {
    this.isRunning = false;
    if (this.consumePromise) {
      await this.consumePromise;
    }
    if (this.redis) {
      await this.redis.quit();
    }
  }

  /**
   * Ensures the consumer group exists. Creates it if it doesn't.
   */
  private async ensureConsumerGroup(): Promise<void> {
    if (!this.redis) return;

    try {
      // Try to create the consumer group starting from the beginning of the stream
      // The '0' means start from the oldest message
      await this.redis.xgroup(
        'CREATE',
        this.streamName,
        this.consumerGroup,
        '0',
        'MKSTREAM',
      );
      this.logger.log(`Created consumer group: ${this.consumerGroup}`);
    } catch (error: unknown) {
      // Error code BUSYGROUP means the group already exists, which is fine
      if (error instanceof Error && error.message?.includes('BUSYGROUP')) {
        this.logger.verbose(
          `Consumer group already exists: ${this.consumerGroup}`,
          { errorMessage: error.message, context: 'StreamConsumerService' },
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Starts the main consume loop.
   */
  private async startConsuming(): Promise<void> {
    this.isRunning = true;
    this.consumePromise = this.consumeLoop();
  }

  /**
   * Main consume loop - continuously reads from the stream.
   */
  private async consumeLoop(): Promise<void> {
    while (this.isRunning && this.redis) {
      try {
        // read new messages
        // XREADGROUP GROUP group consumer BLOCK ms COUNT n STREAMS stream >
        // '>' means only read new messages that haven't been delivered to any consumer
        const result = (await this.redis.xreadgroup(
          'GROUP',
          this.consumerGroup,
          this.consumerName,
          'COUNT',
          this.streamsConfig.batchSize,
          'BLOCK',
          this.streamsConfig.blockTimeMs,
          'STREAMS',
          this.streamName,
          '>',
        )) as [string, [string, string[]][]][] | null;

        if (!result || result.length === 0) {
          continue; // No new messages, continue loop
        }

        // Process messages in parallel for better throughput
        for (const [_streamName, messages] of result) {
          const results = await Promise.allSettled(
            messages.map(([messageId, fields]) =>
              this.processMessage(messageId, fields),
            ),
          );

          // Log any rejected promises (errors are already logged in processMessage)
          const failures = results.filter(r => r.status === 'rejected');
          if (failures.length > 0) {
            this.logger.warn(
              `Batch completed with ${failures.length}/${messages.length} failures`,
            );
          }
        }
      } catch (error) {
        this.logger.error('Error in consume loop', { error });
        // Brief pause before retrying to avoid tight error loops
        await this.helperService.delay(SECOND);
      }
    }
  }

  /**
   * Claims messages that have been pending for too long (likely from crashed consumers).
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: cron job
  private async autoClaimStaleMessages(): Promise<void> {
    if (!this.redis) return;

    this.logger.verbose('Auto-claiming stale messages', {
      consumerName: this.consumerName,
      autoClaimIdleMs: this.streamsConfig.autoClaimIdleMs,
      batchSize: this.streamsConfig.batchSize,
    });

    try {
      // XAUTOCLAIM claims messages pending longer than min-idle-time
      const result = (await this.redis.xautoclaim(
        this.streamName,
        this.consumerGroup,
        this.consumerName,
        this.streamsConfig.autoClaimIdleMs,
        '0-0', // Start from the beginning
        'COUNT',
        this.streamsConfig.batchSize,
      )) as [string, [string, string[]][], string[]];

      // Result: [next-id, [messages], [deleted-ids]]
      const messages = result[1];

      if (messages && messages.length > 0) {
        this.logger.warn(
          `Auto-claimed ${messages.length} stale messages from other consumers`,
          {
            consumerName: this.consumerName,
            messageCount: messages.length,
          },
        );

        for (const [messageId, fields] of messages) {
          await this.processMessage(messageId, fields);
        }
      }
    } catch (error) {
      this.logger.error('Error auto-claiming stale messages', { error });
    }
  }

  /**
   * Processes a single message from the stream.
   */
  private async processMessage(
    messageId: string,
    fields: string[],
  ): Promise<void> {
    if (!this.redis) return;

    let event: BaseEvent<EventType> | undefined;
    let timer: NodeJS.Timeout | undefined;
    const timeoutMs = SECOND * 10;
    const timeoutPromise = (message: string) =>
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      });
    try {
      // Parse the event from the stream message
      // Fields come as [key1, value1, key2, value2, ...]
      const eventJson = fields[1]; // We stored it as 'event' key, so value is at index 1
      event = JSON.parse(eventJson) as BaseEvent<EventType>;

      // Get retry count from the pending entry
      const retryCount = await this.getRetryCount(messageId);

      if (retryCount >= this.streamsConfig.maxRetries) {
        this.logger.error(
          `Message exceeded max retries (${this.streamsConfig.maxRetries}), moving to dead letter queue`,
          {
            eventId: event.eventId,
            eventType: event.eventType,
            messageId,
            retryCount,
          },
        );
        await this.moveToDeadLetter(messageId, event, retryCount);
        await this.acknowledgeMessage(messageId);
        return;
      }

      // Find the handler for this event type
      const handler = this.discoveryService.getHandler(event.eventType);

      if (!handler) {
        this.logger.warn(
          `No handler found for event type: ${event.eventType}`,
          {
            eventId: event.eventId,
            eventType: event.eventType,
            messageId,
          },
        );
        // Acknowledge to prevent infinite retries
        await this.acknowledgeMessage(messageId);
        return;
      }

      // Run the handler in the context
      await this.contextService.runWithContext(
        {
          flow: 'stream',
          context: 'StreamConsumer',
          event: event.eventType,
          requestId: event.requestId,
          userId: event.metadata?.userId,
        },
        async () => {
          if (event) {
            const method = handler.instance[handler.methodName];
            if (typeof method === 'function') {
              await Promise.race([
                method.call(handler.instance, event),
                timeoutPromise(
                  `Handler ${handler.methodName} timed out after ${timeoutMs}ms`,
                ),
              ]);
            }
          }
        },
      );

      await this.acknowledgeMessage(messageId);

      this.logger.verbose(`Processed stream message ${messageId}`, {
        eventId: event.eventId,
        eventType: event.eventType,
        messageId,
      });
    } catch (error) {
      this.logger.error(`Failed to process stream message ${messageId}`, {
        eventId: event?.eventId,
        eventType: event?.eventType,
        messageId,
        error,
      });

      // Don't acknowledge - message will be retried
      // After idle time passes, it will be auto-claimed or reprocessed
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Gets the retry count for a message by checking how many times it's been delivered.
   */
  private async getRetryCount(messageId: string): Promise<number> {
    if (!this.redis) return 0;

    try {
      // XPENDING returns info about pending messages
      const pending = (await this.redis.xpending(
        this.streamName,
        this.consumerGroup,
        messageId,
        messageId,
        1,
      )) as [string, string, number, [string, number][]][];

      if (pending && pending.length > 0) {
        // pending[0][2] is the delivery count
        return pending[0][2] || 0;
      }
    } catch (error) {
      this.logger.warn('Error getting retry count', { messageId, error });
    }

    return 0;
  }

  /**
   * Acknowledges a message, removing it from the pending list.
   */
  private async acknowledgeMessage(messageId: string): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.xack(this.streamName, this.consumerGroup, messageId);
      this.logger.verbose(`Acknowledged message ${messageId}`);
    } catch (error) {
      this.logger.warn('Failed to acknowledge message', { messageId, error });
    }
  }

  /**
   * Moves a failed message to the dead letter queue.
   */
  private async moveToDeadLetter(
    messageId: string,
    event: BaseEvent<EventType>,
    retryCount: number,
  ): Promise<void> {
    if (!this.redis) return;

    try {
      const deadLetterEvent = {
        ...event,
        failureInfo: {
          originalMessageId: messageId,
          retryCount,
          failedAt: new Date().toISOString(),
          consumerName: this.consumerName,
        },
      };

      await this.redis.xadd(
        this.deadLetterStreamName,
        '*',
        'event',
        JSON.stringify(deadLetterEvent),
      );

      this.logger.log(`Moved message to dead letter queue`, {
        eventId: event.eventId,
        eventType: event.eventType,
        originalMessageId: messageId,
        retryCount,
      });
    } catch (error) {
      this.logger.error('Failed to move message to dead letter queue', {
        messageId,
        error,
      });
    }
  }
}
