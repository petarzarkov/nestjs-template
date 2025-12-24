import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import 'reflect-metadata';
import pkgJson from '../package.json';
import { AppModule } from './app.module';
import { AppEnv } from './config/enum/app-env.enum';
import type { ValidatedConfig } from './config/env.validation';
import { AppConfigService } from './config/services/app.config.service';
import { GLOBAL_PREFIX } from './constants';
import { GenericExceptionFilter } from './core/filters/generic-exception.filter';
import { TypeOrmExceptionFilter } from './core/filters/typeorm-exception.filter';
import { HttpLoggingInterceptor } from './core/interceptors/http-logging.interceptor';
import {
  bootstrapLogger,
  ContextLogger,
} from './logger/services/context-logger.service';
import { EventsGateway } from './notifications/events/events.gateway';
import { SocketConfigAdapter } from './notifications/events/socket.adapter';
import { setupSwagger } from './swagger/setupSwagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    forceCloseConnections: true,
    rawBody: true,
    bufferLogs: false,
    logger: bootstrapLogger(pkgJson),
  });
  const configService = app.get(AppConfigService<ValidatedConfig>);
  const logger = app.get(ContextLogger);

  // Add global exception handling
  process.on('uncaughtException', error => {
    logger.fatal('Uncaught Exception', { err: error });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('Unhandled Rejection', { err: error });
  });

  app.useLogger(logger);
  const httpLoggingInterceptor = app.get(HttpLoggingInterceptor);
  const genericExceptionFilter = app.get(GenericExceptionFilter);
  const typeOrmExceptionFilter = app.get(TypeOrmExceptionFilter);
  const appConfig = configService.get('app');

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalInterceptors(httpLoggingInterceptor);
  app.useGlobalFilters(genericExceptionFilter, typeOrmExceptionFilter);
  app.set('trust proxy', true);
  const corsOpts = {
    origin: configService.get('cors.origin'),
    credentials: appConfig.env === AppEnv.PRD,
  };
  app.enableCors(corsOpts);

  // Only enable shutdown hooks in production to avoid hot reload issues
  if (appConfig.nodeEnv === 'production') {
    app.enableShutdownHooks();
  }
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  const { title, swaggerPath } = setupSwagger(app);

  app.useWebSocketAdapter(new SocketConfigAdapter(app, configService));

  await app.startAllMicroservices();
  const appPort = configService.get('app.port');
  await app.listen(appPort, '0.0.0.0');

  const eventsGateway = app.get(EventsGateway);
  const wsConfig = configService.get('ws');
  const appUrl = await app.getUrl();
  logger.log(`API ${title} service started at ${appUrl}`, {
    versions: process.versions,
  });
  logger.verbose(`API Docs at ${appUrl}${swaggerPath}`);

  const wsUrl =
    appUrl
      .replace('http', 'ws')
      .replace(
        appPort.toString(),
        wsConfig.port?.toString() || appPort.toString(),
      ) + wsConfig.path;

  const sharingHttpServer =
    !wsConfig.port || wsConfig.port?.toString() === appPort.toString();
  logger.log(
    `WebSocket Gateway started at ${wsUrl} - ${sharingHttpServer ? 'sharing REST API HTTP server' : 'using separate TCP server'}`,
    {
      options: eventsGateway.server._opts,
    },
  );
}

bootstrap().catch(error => {
  console.error('Failed to bootstrap application:', error);
  process.exit(1);
});
