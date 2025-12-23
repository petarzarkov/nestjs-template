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
import { LoggerModule } from './logger/logger.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
    }),
    DatabaseModule.forRoot(),
    PaginationModule,
    LoggerModule,
    HealthModule,
    AuthModule,
    UsersModule,
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
