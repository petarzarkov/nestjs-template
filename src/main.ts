import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import 'reflect-metadata';
import pkgJson from '../package.json';
import { AppModule } from './app.module';
import type { ValidatedServiceConfig } from './config';
import { AppConfigService } from './config';
import { GLOBAL_PREFIX } from './constants';
import { DrizzleExceptionFilter } from './core/filters/drizzle-exception.filter';
import { GenericExceptionFilter } from './core/filters/generic-exception.filter';
import { HttpLoggingInterceptor } from './core/interceptors/http-logging.interceptor';
import { bootstrapLogger, ContextLogger } from './logger/services/context-logger.service';
import { setupSwagger } from './swagger/setupSwagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    forceCloseConnections: true,
    rawBody: true,
    bufferLogs: false,
    logger: bootstrapLogger(pkgJson),
  });
  const configService = app.get(AppConfigService<ValidatedServiceConfig>);
  const logger = app.get(ContextLogger);

  // Add global exception handling
  process.on('uncaughtException', (error) => {
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
  const drizzleExceptionFilter = app.get(DrizzleExceptionFilter);
  const appConfig = configService.get('app');

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalInterceptors(httpLoggingInterceptor);
  app.useGlobalFilters(genericExceptionFilter, drizzleExceptionFilter);
  app.set('trust proxy', true);
  app.enableCors({
    origin: '*',
    credentials: true,
  });

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
    })
  );

  const { title, swaggerPath } = setupSwagger(app);

  await app.startAllMicroservices();
  await app.listen(configService.get('app.port'), '0.0.0.0');

  const appUrl = await app.getUrl();
  logger.log(`${title} service started at ${appUrl}`, {
    versions: process.versions,
  });
  logger.log(`API Docs at ${appUrl}${swaggerPath}`);
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application:', error);
  process.exit(1);
});
