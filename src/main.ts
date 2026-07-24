import { NestJsCmsModule } from '@arkv/nestjs-cms';
import { ContextLogger } from '@arkv/nestjs-context-logger';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AuthService } from '@thallesp/nestjs-better-auth';
import 'reflect-metadata';
import pkg from '../package.json';
import { AppModule } from './app.module';
import type { Auth } from './auth/auth.config';
import { AppEnv } from './config/enum/app-env.enum';
import type { ValidatedConfig } from './config/env.validation';
import { AppConfigService } from './config/services/app.config.service';
import { GLOBAL_PREFIX } from './constants';
import { setupDocs } from './core/docs/setupDocs';
import { DbExceptionFilter } from './core/filters/db-exception.filter';
import { GenericExceptionFilter } from './core/filters/generic-exception.filter';
import { HttpLoggingInterceptor } from './core/interceptors/http-logging.interceptor';
import { RequestMiddleware } from './core/middlewares/request.middleware';
import { RedisService } from './infra/redis/services/redis.service';
import { SocketConfigAdapter } from './notifications/events/socket.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    forceCloseConnections: true,
    // Better Auth requires the raw request body, so NestJS's body parser is
    // disabled here and re-enabled for non-auth routes by AuthModule's
    // `bodyParser` option (see app.module.ts).
    bodyParser: false,
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

  const dbExceptionFilter = app.get(DbExceptionFilter);
  const genericExceptionFilter = app.get(GenericExceptionFilter);
  const httpLoggingInterceptor = app.get(HttpLoggingInterceptor);

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalInterceptors(httpLoggingInterceptor);
  app.useGlobalFilters(genericExceptionFilter, dbExceptionFilter);

  // Global configuration
  app.setGlobalPrefix(GLOBAL_PREFIX);

  // Trust proxy for correct IP detection behind load balancers
  app.set('trust proxy', true);

  // CORS
  app.enableCors({
    origin: corsConfig.origin,
    credentials: appConfig.env === AppEnv.PRD,
  });

  // Request validation is handled globally by the ZodValidationPipe
  // (registered as APP_PIPE in AppModule).

  // Swagger documentation (merges the Better Auth routes into the doc)
  const auth = app.get<AuthService<Auth>>(AuthService).instance;
  const { title, document, swaggerPath, scalarPath } = await setupDocs(
    app,
    pkg,
    appConfig,
    auth,
  );

  // The Bull Board queue dashboard is mounted (and basic-auth protected in
  // deployed envs) by QueueDashboardModule — see
  // src/infra/queue/queue-dashboard.module.ts.
  const queuesPath = `/${GLOBAL_PREFIX}/queues`;

  // Admin CMS UI driven by the OpenAPI document (mount after docs are built)
  await NestJsCmsModule.setup(app, document, {
    path: '/cms',
    apiPrefix: `/${GLOBAL_PREFIX}`,
    title,
  });

  const redisService = app.get(RedisService);
  app.useWebSocketAdapter(
    new SocketConfigAdapter(app, configService, redisService),
  );

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

  logger.log(
    `API ${title} service, docs at ${appUrl}${swaggerPath} and scalar at ${appUrl}${scalarPath}`,
    {
      versions: {
        node: process.versions.node,
        bun: process.versions.bun,
        npm: process.versions.npm,
      },
      queuesDashboard: `${appUrl}${queuesPath}`,
      ws: {
        url: wsUrl,
        sharingHttpServer: sharingHttpServer,
      },
    },
  );
}

bootstrap().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
