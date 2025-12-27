import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { redisStore } from 'cache-manager-ioredis-yet';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { StreamsModule } from './streams/streams.module';

/**
 * Redis module that conditionally enables Redis features based on environment variables.
 * Features (all require REDIS_HOST to be set):
 * - REDIS_CACHE_ENABLED: Cache interceptor with Redis store (no fallback)
 * - REDIS_THROTTLE_ENABLED: Rate limiting via Redis (no fallback)
 * - REDIS_WS_ADAPTER_ENABLED: Socket.io Redis adapter (configured in socket.adapter.ts)
 * - REDIS_STREAMS_ENABLED: Event streaming with guaranteed delivery and retries
 */
@Module({})
export class RedisModule {
  static forRootAsync(): DynamicModule {
    // Read config at module registration time to determine what to include
    const redisHost = process.env.REDIS_HOST;
    const throttleEnabled =
      Boolean(redisHost) && process.env.REDIS_THROTTLE_ENABLED === 'true';
    const cacheEnabled =
      Boolean(redisHost) && process.env.REDIS_CACHE_ENABLED === 'true';
    const streamsEnabled =
      Boolean(redisHost) && process.env.REDIS_STREAMS_ENABLED === 'true';

    const imports: DynamicModule['imports'] = [];
    const providers: Provider[] = [];
    const exports: (string | symbol | Type)[] = [];

    if (throttleEnabled) {
      imports.push(
        ThrottlerModule.forRootAsync({
          inject: [AppConfigService],
          useFactory: (configService: AppConfigService<ValidatedConfig>) => {
            const redisConfig = configService.getOrThrow('redis');
            return {
              throttlers: [
                {
                  ttl: redisConfig.throttle.ttl,
                  limit: redisConfig.throttle.limit,
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

    if (cacheEnabled) {
      imports.push(
        CacheModule.registerAsync({
          inject: [AppConfigService],
          isGlobal: true,
          useFactory: async (
            configService: AppConfigService<ValidatedConfig>,
          ) => {
            const redisConfig = configService.getOrThrow('redis');
            return {
              store: await redisStore({
                host: redisConfig.host,
                port: redisConfig.port,
                password: redisConfig.password,
                db: redisConfig.db,
                ttl: redisConfig.cache.ttl,
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

    if (streamsEnabled) {
      imports.push(StreamsModule.forRootAsync());
      exports.push(StreamsModule);
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
