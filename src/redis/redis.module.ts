import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { BullModule } from '@nestjs/bullmq';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { ExecutionContext, Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { NotificationModule } from '@/notifications/notification.module';
import { KeyvIoredisAdapter } from './services/keyv-ioredis-adapter';
import { RedisService } from './services/redis.service';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redisService: RedisService) => {
        const redisClient = redisService.redisClient;
        return {
          throttlers: [
            {
              name: 'short',
              ttl: 1000,
              limit: 5,
              skipIf: (context: ExecutionContext) =>
                !!context.switchToHttp().getRequest<Request>().user,
            },
            {
              name: 'medium',
              ttl: 10000,
              limit: 50,
              skipIf: (context: ExecutionContext) =>
                !!context.switchToHttp().getRequest<Request>().user,
            },
            {
              name: 'long',
              ttl: 60000,
              limit: 300,
              skipIf: (context: ExecutionContext) =>
                !!context.switchToHttp().getRequest<Request>().user,
            },
          ],
          storage: new ThrottlerStorageRedisService(redisClient),
        };
      },
    }),
    CacheModule.registerAsync({
      inject: [AppConfigService, RedisService],
      isGlobal: true,
      useFactory: async (
        configService: AppConfigService<ValidatedConfig>,
        redisService: RedisService,
      ) => {
        const redisConfig = configService.getOrThrow('redis');
        const redisClient = redisService.redisClient;
        const adapter = new KeyvIoredisAdapter(redisClient);

        return {
          ttl: redisConfig.cache.ttl,
          stores: [adapter],
        };
      },
    }),
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService<ValidatedConfig>) => {
        const redisConfig = configService.getOrThrow('redis');

        // Leave the connection to the Redis client to the BullMQ module to manage.
        return {
          connection: {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db,
          },
        };
      },
    }),
    NotificationModule,
  ],
  providers: [
    RedisService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
  exports: [
    ThrottlerModule,
    CacheModule,
    BullModule,
    NotificationModule,
    RedisService,
  ],
})
export class RedisModule {}
