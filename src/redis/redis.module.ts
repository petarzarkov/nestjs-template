import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { redisStore } from 'cache-manager-ioredis-yet';
import { EventLoggingInterceptor } from './pubsub/event-logging.interceptor';
import { EventPublisherService } from './pubsub/event-publisher.service';
import { REDIS_EVENT_CLIENT } from './redis.constants';

/**
 * Redis module that conditionally enables Redis features based on environment variables.
 * Features (all require REDIS_HOST to be set):
 * - REDIS_CACHE_ENABLED: Cache interceptor with Redis store (no fallback)
 * - REDIS_THROTTLE_ENABLED: Rate limiting via Redis (no fallback)
 * - REDIS_WS_ADAPTER_ENABLED: Socket.io Redis adapter (configured in socket.adapter.ts)
 * - REDIS_PUBSUB_ENABLED: Event pub/sub via NestJS microservices
 */
@Module({})
export class RedisModule {
  static forRootAsync(): DynamicModule {
    // Read config at module registration time to determine what to include
    const redisHost = process.env.REDIS_HOST;
    const throttleEnabled =
      redisHost && process.env.REDIS_THROTTLE_ENABLED === 'true';
    const cacheEnabled =
      redisHost && process.env.REDIS_CACHE_ENABLED === 'true';
    const pubsubEnabled =
      redisHost && process.env.REDIS_PUBSUB_ENABLED === 'true';

    const imports: DynamicModule['imports'] = [];
    const providers: Provider[] = [
      EventPublisherService,
      EventLoggingInterceptor,
    ];
    const exports: (string | symbol | Type)[] = [
      EventPublisherService,
      EventLoggingInterceptor,
    ];

    // Throttler module - only add Redis storage when enabled
    if (throttleEnabled) {
      imports.push(
        ThrottlerModule.forRootAsync({
          inject: [AppConfigService],
          useFactory: (configService: AppConfigService<ValidatedConfig>) => {
            const redisConfig = configService.get('redis')!;
            return {
              throttlers: [
                {
                  ttl: redisConfig.throttleTtl,
                  limit: redisConfig.throttleLimit,
                },
              ],
              storage: new ThrottlerStorageRedisService({
                host: redisConfig.host,
                port: redisConfig.port,
                password: redisConfig.password,
                db: redisConfig.db,
              }),
            };
          },
        }),
      );
      providers.push({
        provide: APP_GUARD,
        useClass: ThrottlerGuard,
      });
      exports.push(ThrottlerModule);
    }

    // Cache module - only register when Redis cache is enabled (no in-memory fallback)
    if (cacheEnabled) {
      imports.push(
        CacheModule.registerAsync({
          inject: [AppConfigService],
          isGlobal: true,
          useFactory: async (
            configService: AppConfigService<ValidatedConfig>,
          ) => {
            const redisConfig = configService.get('redis')!;
            return {
              store: await redisStore({
                host: redisConfig.host,
                port: redisConfig.port,
                password: redisConfig.password,
                db: redisConfig.db,
                ttl: 30000, // 30 seconds default
              }),
            };
          },
        }),
      );
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: CacheInterceptor,
      });
      exports.push(CacheModule);
    }

    // Pub/sub client module - only register when enabled
    if (pubsubEnabled) {
      imports.push(
        ClientsModule.registerAsync([
          {
            name: REDIS_EVENT_CLIENT,
            inject: [AppConfigService, ContextLogger],
            useFactory: (
              configService: AppConfigService<ValidatedConfig>,
              logger: ContextLogger,
            ) => {
              const redisConfig = configService.get('redis')!;
              logger.log('Redis pub/sub enabled', {
                host: redisConfig.host,
                port: redisConfig.port,
              });

              return {
                transport: Transport.REDIS,
                options: {
                  host: redisConfig.host,
                  port: redisConfig.port,
                  password: redisConfig.password,
                  db: redisConfig.db,
                },
              };
            },
          },
        ]),
      );
      exports.push(ClientsModule);
    }

    return {
      module: RedisModule,
      global: true,
      imports,
      providers,
      exports,
    };
  }
}
