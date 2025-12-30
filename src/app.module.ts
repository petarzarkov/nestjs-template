import { join } from 'node:path';
import { HttpModule } from '@nestjs/axios';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AIModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/app.config.module';
import { ValidatedConfig, validateConfig } from './config/env.validation';
import { AppConfigService } from './config/services/app.config.service';
import { GenericExceptionFilter } from './core/filters/generic-exception.filter';
import { TypeOrmExceptionFilter } from './core/filters/typeorm-exception.filter';
import { HttpLoggingInterceptor } from './core/interceptors/http-logging.interceptor';
import { RequestMiddleware } from './core/middlewares/request.middleware';
import { PaginationModule } from './core/pagination/pagination.module';
import { DatabaseModule } from './db/database.module';
import { HealthModule } from './health/health.module';
import { HelpersModule } from './helpers/helpers.module';
import { LoggerModule } from './logger/logger.module';
import { RedisModule } from './redis/redis.module';
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
    ScheduleModule.forRoot(),
    HelpersModule,
    DatabaseModule.forRoot(),
    RedisModule,
    PaginationModule,
    LoggerModule,
    HealthModule,
    AuthModule.forRoot(),
    UsersModule,
    AIModule.forRoot(),
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
