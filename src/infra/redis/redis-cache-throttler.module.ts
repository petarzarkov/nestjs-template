import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { CacheModule } from '@nestjs/cache-manager';
import { ExecutionContext, Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { AppConfigService } from '@/config/services/app.config.service';
import { KeyvIoredisAdapter } from './services/keyv-ioredis-adapter';
import { RedisService } from './services/redis.service';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redisService: RedisService) => {
        const redisClient = redisService.newConnection('throttler', {
          db: 2,
        });
        return {
          throttlers: [
            {
              name: 'short',
              ttl: 1000,
              limit: 10,
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
        configService: AppConfigService,
        redisService: RedisService,
      ) => {
        const redisConfig = configService.getOrThrow('redis');
        const redisClient = redisService.newConnection('rest-cache', {
          db: 3,
        });
        const adapter = new KeyvIoredisAdapter(redisClient);

        return {
          ttl: redisConfig.cache.ttl,
          stores: [adapter],
        };
      },
    }),
  ],
  providers: [
    RedisService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [ThrottlerModule, CacheModule],
})
export class RedisCacheThrottlerModule {}
