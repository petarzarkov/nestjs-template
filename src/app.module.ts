import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppConfigModule } from './config/app.config.module';
import { validateConfig } from './config/env.validation';
import { DrizzleExceptionFilter } from './core/filters/drizzle-exception.filter';
import { GenericExceptionFilter } from './core/filters/generic-exception.filter';
import { HttpLoggingInterceptor } from './core/interceptors/http-logging.interceptor';
import { RequestMiddleware } from './core/middlewares/request.middleware';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [
    AppConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
    }),
    DatabaseModule,
    LoggerModule,
    HealthModule,
  ],
  providers: [
    HttpLoggingInterceptor,
    DrizzleExceptionFilter,
    GenericExceptionFilter,
    RequestMiddleware,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestMiddleware).forRoutes('*wildcard');
  }
}
