import { join } from 'node:path';
import { NestJsCmsModule } from '@arkv/nestjs-cms';
import { NestJsContextLoggerModule } from '@arkv/nestjs-context-logger';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ZodValidationPipe } from 'nestjs-zod';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AIModule } from './ai/ai.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/app.config.module';
import { validateConfig } from './config/env.validation';
import { loggerModuleAsyncOptions } from './config/logger.config';
import { DbExceptionFilter } from './core/filters/db-exception.filter';
import { GenericExceptionFilter } from './core/filters/generic-exception.filter';
import { HelpersModule } from './core/helpers/helpers.module';
import { AuditContextInterceptor } from './core/interceptors/audit-context.interceptor';
import { HttpLoggingInterceptor } from './core/interceptors/http-logging.interceptor';
import { HtmlBasicAuthMiddleware } from './core/middlewares/html-basic-auth.middleware';
import { RequestMiddleware } from './core/middlewares/request.middleware';
import { PaginationModule } from './core/pagination/pagination.module';
import { FileModule } from './file/file.module';
import { DatabaseModule } from './infra/db/database.module';
import { HealthModule } from './infra/health/health.module';
import { QueueDashboardModule } from './infra/queue/queue-dashboard.module';
import { QueueModule } from './infra/queue/queue.module';
import { RedisCacheThrottlerModule } from './infra/redis/redis-cache-throttler.module';
import { RedisModule } from './infra/redis/redis.module';
import { NotificationModule } from './notifications/notification.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
      exclude: ['/api*'],
    }),
    AuthModule.forRoot(),
    ScheduleModule.forRoot(),
    HelpersModule,
    DatabaseModule.forRoot(),
    RedisModule,
    RedisCacheThrottlerModule,
    PaginationModule,
    NestJsContextLoggerModule.forRootAsync(loggerModuleAsyncOptions),
    HealthModule,
    UsersModule,
    AuditModule,
    AIModule.forRoot(),
    NotificationModule,
    QueueModule,
    QueueDashboardModule,
    FileModule,
    // Registers CmsSchemaService; the UI + schema routes are mounted in
    // main.ts via NestJsCmsModule.setup(app, document, ...).
    NestJsCmsModule.forRoot(),
  ],
  providers: [
    HttpLoggingInterceptor,
    DbExceptionFilter,
    GenericExceptionFilter,
    RequestMiddleware,
    HtmlBasicAuthMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditContextInterceptor,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
