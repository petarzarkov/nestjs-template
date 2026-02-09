import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AIModule } from '@/ai/ai.module';
import { AppConfigModule } from '@/config/app.config.module';
import { ValidatedConfig, validateConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { HelpersModule } from '@/core/helpers/helpers.module';
import { PaginationModule } from '@/core/pagination/pagination.module';
import { FileModule } from '@/file/file.module';
import { NotificationModule } from '@/notifications/notification.module';
import { UsersModule } from '@/users/users.module';
import { DatabaseModule } from '../db/database.module';
import { HealthModule } from '../health/health.module';
import { LoggerModule } from '../logger/logger.module';
import { RedisModule } from '../redis/redis.module';
import { RedisCacheThrottlerModule } from '../redis/redis-cache-throttler.module';
import { QueueModule } from './queue.module';

@Module({
  imports: [
    AppConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
    }),
    HttpModule.registerAsync({
      global: true,
      imports: [AppConfigModule],
      useFactory: async (configService: AppConfigService<ValidatedConfig>) => ({
        timeout: configService.getOrThrow('http.timeout'),
        maxRedirects: configService.getOrThrow('http.maxRedirects'),
      }),
      inject: [AppConfigService],
    }),
    HelpersModule,
    DatabaseModule.forRoot(),
    RedisModule,
    LoggerModule,
    HealthModule,
    PaginationModule,
    UsersModule,
    AIModule.forRoot(),
    NotificationModule,
    QueueModule,
    RedisCacheThrottlerModule,
    FileModule,
  ],
  providers: [],
})
export class JobModule {}
