import { NestJsContextLoggerModule } from '@arkv/nestjs-context-logger';
import { Module } from '@nestjs/common';
import { AIModule } from '@/ai/ai.module';
import { AppConfigModule } from '@/config/app.config.module';
import { validateConfig } from '@/config/env.validation';
import { loggerModuleAsyncOptions } from '@/config/logger.config';
import { HelpersModule } from '@/core/helpers/helpers.module';
import { PaginationModule } from '@/core/pagination/pagination.module';
import { FileModule } from '@/file/file.module';
import { NotificationModule } from '@/notifications/notification.module';
import { UsersModule } from '@/users/users.module';
import { DatabaseModule } from '../db/database.module';
import { HealthModule } from '../health/health.module';
import { RedisModule } from '../redis/redis.module';
import { RedisCacheThrottlerModule } from '../redis/redis-cache-throttler.module';
import { QueueModule } from './queue.module';

@Module({
  imports: [
    AppConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
    }),
    HelpersModule,
    DatabaseModule.forRoot(),
    RedisModule,
    NestJsContextLoggerModule.forRootAsync(loggerModuleAsyncOptions),
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
