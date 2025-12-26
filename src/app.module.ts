import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/app.config.module';
import { validateConfig } from './config/env.validation';
import { GenericExceptionFilter } from './core/filters/generic-exception.filter';
import { TypeOrmExceptionFilter } from './core/filters/typeorm-exception.filter';
import { HttpLoggingInterceptor } from './core/interceptors/http-logging.interceptor';
import { RequestMiddleware } from './core/middlewares/request.middleware';
import { PaginationModule } from './core/pagination/pagination.module';
import { DatabaseModule } from './db/database.module';
import { HealthModule } from './health/health.module';
import { HelpersModule } from './helpers/helpers.module';
import { LoggerModule } from './logger/logger.module';
import { NotificationModule } from './notifications/notification.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
    }),
    HelpersModule,
    DatabaseModule.forRoot(),
    RedisModule.forRootAsync(),
    PaginationModule,
    LoggerModule,
    HealthModule,
    AuthModule.forRoot(),
    UsersModule,
    NotificationModule,
  ],
  providers: [
    HttpLoggingInterceptor,
    TypeOrmExceptionFilter,
    GenericExceptionFilter,
    RequestMiddleware,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestMiddleware).forRoutes('*wildcard');
  }
}
