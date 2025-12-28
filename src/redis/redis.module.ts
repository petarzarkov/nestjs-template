import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { BullModule } from '@nestjs/bullmq';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { redisStore } from 'cache-manager-ioredis-yet';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { NotificationModule } from '@/notifications/notification.module';

@Global()
@Module({
  imports: [
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
    CacheModule.registerAsync({
      inject: [AppConfigService],
      isGlobal: true,
      useFactory: async (configService: AppConfigService<ValidatedConfig>) => {
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
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService<ValidatedConfig>) => {
        const redisConfig = configService.getOrThrow('redis');
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
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
  exports: [ThrottlerModule, CacheModule, BullModule, NotificationModule],
})
export class RedisModule {}
