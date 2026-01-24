import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import 'reflect-metadata';
import pkg from '../package.json';
import { AppModule } from './app.module';
import { AppEnv } from './config/enum/app-env.enum';
import type { ValidatedConfig } from './config/env.validation';
import { AppConfigService } from './config/services/app.config.service';
import { GLOBAL_PREFIX } from './constants';
import { GenericExceptionFilter } from './core/filters/generic-exception.filter';
import { TypeOrmExceptionFilter } from './core/filters/typeorm-exception.filter';
import { HttpLoggingInterceptor } from './core/interceptors/http-logging.interceptor';
import { RequestMiddleware } from './core/middlewares/request.middleware';
import { setupSwagger } from './core/swagger/setupSwagger';
import { ContextLogger } from './infra/logger/services/context-logger.service';
import { RedisService } from './infra/redis/services/redis.service';
import { SocketConfigAdapter } from './notifications/events/socket.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    forceCloseConnections: true,
    rawBody: true,
    logger: ['fatal', 'error', 'warn'],
  });
  const logger = app.get(ContextLogger);
  app.useLogger(logger);

  // Apply request middleware at Express level (before NestJS routing)
  // This ensures context is set for ALL requests, including 404s
  const requestMiddleware = app.get(RequestMiddleware);
  app.use(requestMiddleware.use.bind(requestMiddleware));

  // Add global exception handling
  process.on('uncaughtException', (error, origin) => {
    logger.fatal('Uncaught Exception', { err: error, origin });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('Unhandled Rejection', { err: error, promise });
  });

  const configService = app.get(AppConfigService<ValidatedConfig>);
  const appConfig = configService.getOrThrow('app');
  if (appConfig.nodeEnv === 'production') {
    app.enableShutdownHooks();
  }

  const corsConfig = configService.getOrThrow('cors');
  const redisConfig = configService.getOrThrow('redis');
  if (redisConfig) {
    logger.log('Redis config', {
      redisConfig,
    });
  }

  const typeOrmExceptionFilter = app.get(TypeOrmExceptionFilter);
  const genericExceptionFilter = app.get(GenericExceptionFilter);
  const httpLoggingInterceptor = app.get(HttpLoggingInterceptor);

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalInterceptors(httpLoggingInterceptor);
  app.useGlobalFilters(genericExceptionFilter, typeOrmExceptionFilter);

  // Global configuration
  app.setGlobalPrefix(GLOBAL_PREFIX);

  // Trust proxy for correct IP detection behind load balancers
  app.set('trust proxy', true);

  // CORS
  app.enableCors({
    origin: corsConfig.origin,
    credentials: appConfig.env === AppEnv.PRD,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger documentation
  const { title, swaggerPath } = setupSwagger(app, pkg, appConfig);

  const redisService = app.get(RedisService);
  app.useWebSocketAdapter(
    new SocketConfigAdapter(app, configService, redisService),
  );

  await app.startAllMicroservices();
  const appPort = configService.get('app.port');
  await app.listen(appPort, '0.0.0.0');

  const wsConfig = configService.get('ws');
  const appUrl = await app.getUrl();

  const wsUrl =
    appUrl
      .replace('http', 'ws')
      .replace(
        appPort.toString(),
        wsConfig.port?.toString() || appPort.toString(),
      ) + wsConfig.path;

  const sharingHttpServer =
    !wsConfig.port || wsConfig.port?.toString() === appPort.toString();

  logger.log(`API ${title} service, docs at ${appUrl}${swaggerPath}`, {
    versions: {
      node: process.versions.node,
      bun: process.versions.bun,
      npm: process.versions.npm,
    },
    queuesDashboard: `${appUrl}/${GLOBAL_PREFIX}/queues`,
    ws: {
      url: wsUrl,
      sharingHttpServer: sharingHttpServer,
    },
  });
}

bootstrap().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
