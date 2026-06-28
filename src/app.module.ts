import { join } from 'node:path';
import { NestJsCmsModule } from '@arkv/nestjs-cms';
import { NestJsContextLoggerModule } from '@arkv/nestjs-context-logger';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AIModule } from './ai/ai.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/app.config.module';
import { ValidatedConfig, validateConfig } from './config/env.validation';
import { loggerModuleAsyncOptions } from './config/logger.config';
import { AppConfigService } from './config/services/app.config.service';
import { GenericExceptionFilter } from './core/filters/generic-exception.filter';
import { TypeOrmExceptionFilter } from './core/filters/typeorm-exception.filter';
import { HelpersModule } from './core/helpers/helpers.module';
import { HttpLoggingInterceptor } from './core/interceptors/http-logging.interceptor';
import { HtmlBasicAuthMiddleware } from './core/middlewares/html-basic-auth.middleware';
import { RequestMiddleware } from './core/middlewares/request.middleware';
import { PaginationModule } from './core/pagination/pagination.module';
import { FileModule } from './file/file.module';
import { DatabaseModule } from './infra/db/database.module';
import { HealthModule } from './infra/health/health.module';
import { QueueModule } from './infra/queue/queue.module';
import { QueueDashboardModule } from './infra/queue/queue-dashboard.module';
import { RedisModule } from './infra/redis/redis.module';
import { RedisCacheThrottlerModule } from './infra/redis/redis-cache-throttler.module';
import { NotificationModule } from './notifications/notification.module';
import { UsersModule } from './users/users.module';

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
    TypeOrmExceptionFilter,
    GenericExceptionFilter,
    RequestMiddleware,
    HtmlBasicAuthMiddleware,
  ],
})
export class AppModule {}
