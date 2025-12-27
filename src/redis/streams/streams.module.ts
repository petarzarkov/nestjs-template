import { DynamicModule, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import Redis from 'ioredis';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { REDIS_STREAMS_CLIENT } from './stream.constants';
import { StreamConsumerService } from './stream-consumer.service';
import { StreamEventDiscoveryService } from './stream-event-discovery.service';
import { StreamPublisherService } from './stream-publisher.service';

/**
 * Module for Redis Streams functionality.
 * Provides event publishing and consumption with guaranteed delivery.
 */
@Module({})
export class StreamsModule {
  static forRootAsync(): DynamicModule {
    return {
      module: StreamsModule,
      imports: [DiscoveryModule],
      providers: [
        {
          provide: REDIS_STREAMS_CLIENT,
          inject: [AppConfigService],
          useFactory: (configService: AppConfigService<ValidatedConfig>) => {
            const redisConfig = configService.get('redis');

            if (!redisConfig) {
              return undefined;
            }

            return new Redis({
              host: redisConfig.host,
              port: redisConfig.port,
              password: redisConfig.password,
              db: redisConfig.db,
              // Optimize connection for low latency
              lazyConnect: false, // Connect immediately
              enableReadyCheck: true,
              maxRetriesPerRequest: 3,
              connectTimeout: 10000, // 10 second timeout
              // Note: commandTimeout removed - XREADGROUP uses BLOCK which is intentional waiting
              // Reconnect on error
              retryStrategy(times: number) {
                if (times > 3) {
                  return null; // Stop retrying after 3 attempts
                }
                const delay = Math.min(times * 50, 2000);
                return delay;
              },
              // Reconnect if connection is lost
              reconnectOnError(err: Error) {
                const targetErrors = ['READONLY', 'ECONNREFUSED', 'ETIMEDOUT'];
                return targetErrors.some(targetError =>
                  err.message.includes(targetError),
                );
              },
            });
          },
        },
        StreamEventDiscoveryService,
        StreamPublisherService,
        StreamConsumerService,
      ],
      exports: [StreamPublisherService, StreamEventDiscoveryService],
    };
  }
}
