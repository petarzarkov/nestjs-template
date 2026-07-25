import { join } from 'node:path';
import { NestJsCmsModule } from '@arkv/nestjs-cms';
import { NestJsContextLoggerModule } from '@arkv/nestjs-context-logger';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { ZodValidationPipe } from 'nestjs-zod';
import { AIModule } from './ai/ai.module';
import { AuditModule } from './audit/audit.module';
import { buildAuth } from './auth/auth.config';
import { AppConfigModule } from './config/app.config.module';
import { ValidatedConfig, validateConfig } from './config/env.validation';
import { loggerModuleAsyncOptions } from './config/logger.config';
import { AppConfigService } from './config/services/app.config.service';
import { DbExceptionFilter } from './core/filters/db-exception.filter';
import { GenericExceptionFilter } from './core/filters/generic-exception.filter';
import { HelpersModule } from './core/helpers/helpers.module';
import { AuditContextInterceptor } from './core/interceptors/audit-context.interceptor';
import { HttpLoggingInterceptor } from './core/interceptors/http-logging.interceptor';
import { HtmlBasicAuthMiddleware } from './core/middlewares/html-basic-auth.middleware';
import { RequestMiddleware } from './core/middlewares/request.middleware';
import { PaginationModule } from './core/pagination/pagination.module';
import { FileModule } from './file/file.module';
import {
  DatabaseModule,
  DRIZZLE_DB,
  type DrizzleDB,
} from './infra/db/database.module';
import { HealthModule } from './infra/health/health.module';
import { QueueDashboardModule } from './infra/queue/queue-dashboard.module';
import { QueueModule } from './infra/queue/queue.module';
import { JobPublisherService } from './infra/queue/services/job-publisher.service';
import { RedisCacheThrottlerModule } from './infra/redis/redis-cache-throttler.module';
import { RedisModule } from './infra/redis/redis.module';
import { RedisService } from './infra/redis/services/redis.service';
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
    ScheduleModule.forRoot(),
    HelpersModule,
    DatabaseModule.forRoot(),
    RedisModule,
    QueueModule,
    // Better Auth (stateful sessions in Redis). Builds the auth instance from
    // the Drizzle client, a Redis connection, and the notification queue.
    // NOTE: imported BEFORE RedisCacheThrottlerModule so the global Better Auth
    // `AuthGuard` runs before the `ThrottlerGuard` — the throttler's
    // skip-for-authenticated check relies on `req.user` already being set.
    AuthModule.forRootAsync({
      inject: [DRIZZLE_DB, AppConfigService, RedisService, JobPublisherService],
      useFactory: (
        db: DrizzleDB,
        configService: AppConfigService<ValidatedConfig>,
        redisService: RedisService,
        jobPublisher: JobPublisherService,
      ) => {
        const app = configService.getOrThrow('app');
        const authConfig = configService.getOrThrow('auth');
        return {
          auth: buildAuth({
            db,
            redis: redisService.newConnection('better-auth', { db: 1 }),
            secret: authConfig.secret,
            baseURL: app.webUrl,
            trustedOrigins: [app.webUrl],
            sessionExpiresIn: authConfig.sessionExpiresIn,
            sessionUpdateAge: authConfig.sessionUpdateAge,
            oauth: configService.getOrThrow('oauth'),
            jobPublisher,
          }),
          // NestFactory disables its body parser (see main.ts); re-enable it
          // here for non-auth routes. rawBody replaces NestFactory's rawBody.
          bodyParser: {
            json: { enabled: true },
            urlencoded: { enabled: true, extended: true },
            rawBody: true,
          },
        };
      },
    }),
    RedisCacheThrottlerModule,
    PaginationModule,
    NestJsContextLoggerModule.forRootAsync(loggerModuleAsyncOptions),
    HealthModule,
    UsersModule,
    AuditModule,
    AIModule.forRoot(),
    NotificationModule,
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
