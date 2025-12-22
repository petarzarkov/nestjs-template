import { LogLevel } from '@/logger/log-level.enum';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { LOGGER } from '../../constants';
import { AppEnv } from '../enum/app-env.enum';
import { PackageJson } from '../PackageJson';

export class ServiceVars {
  @IsEnum(AppEnv)
  APP_ENV: AppEnv = AppEnv.LOCAL;

  @IsString()
  @IsOptional()
  NODE_ENV: 'development' | 'testing' | 'production' = 'development';

  @IsEnum(LogLevel)
  @IsOptional()
  LOG_LEVEL: LogLevel = LogLevel.DEBUG;

  @IsOptional()
  @Transform(({ obj }) => {
    if (typeof obj.LOG_MASK_FIELDS === 'string') {
      return obj.LOG_MASK_FIELDS.split(',').map((field: string) => field.trim());
    }
    return LOGGER.defaultMaskFields;
  })
  LOG_MASK_FIELDS?: string[];

  @IsOptional()
  @Transform(({ obj }) => {
    if (typeof obj.LOG_FILTER_EVENTS === 'string') {
      return obj.LOG_FILTER_EVENTS.split(',').map((field: string) => field.trim());
    }
    return LOGGER.defaultFilterEvents;
  })
  LOG_FILTER_EVENTS?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Transform(({ obj }) => {
    return obj.LOG_MAX_ARRAY_LENGTH ? Number(obj.LOG_MAX_ARRAY_LENGTH) : 1;
  })
  LOG_MAX_ARRAY_LENGTH?: number;

  @IsNumber()
  @Min(0)
  @Max(65535)
  API_PORT!: number;

  @ValidateIf((obj: ServiceVars) => [AppEnv.STG, AppEnv.PRD].includes(obj.APP_ENV))
  @IsString({
    message: 'SWAGGER_TOKEN is required when APP_ENV is "stage" or "prod".',
  })
  SWAGGER_TOKEN?: string;

  // --- HTTP Client Configuration ---
  @IsNumber()
  @IsOptional()
  HTTP_REQ_TIMEOUT: number = 30000;

  @IsNumber()
  @IsOptional()
  HTTP_REQ_MAX_REDIRECTS: number = 5;

  @IsNumber()
  @IsOptional()
  HTTP_REQ_MAX_RETRIES: number = 3;

  @IsNumber()
  @IsOptional()
  HTTP_REQ_RETRY_DELAY: number = 1000;

  // --- Service Config ---
  @IsString()
  @IsOptional()
  SERVICE_ROUTE: string = 'service';

  @IsString()
  @IsOptional()
  HEALTH_ROUTE: string = 'health';

  @IsString()
  @IsOptional()
  LIVENESS_ROUTE: string = 'up';

  @IsString()
  @IsOptional()
  CONFIG_ROUTE: string = 'config';

  @IsNumber()
  @IsOptional()
  HEALTH_MAX_MEMORY_MB: number = 2048;

  @IsNumber()
  @IsOptional()
  HEALTH_SHUTDOWN_TIMEOUT_MS: number = 10000;

  @IsString()
  @IsOptional()
  SERVICE_COMMIT_SHA?: string;

  @IsString()
  @IsOptional()
  SERVICE_COMMIT_MESSAGE?: string;

  @IsOptional()
  @IsString()
  SLACK_BOT_TOKEN?: string;

  @IsString()
  @IsOptional()
  SLACK_CHANNEL?: string = 'C0948FPCD8W';

  @IsTimeZone()
  @IsOptional()
  TZ: string = 'UTC';
}

export const getServiceConfig = (pkg: PackageJson, config: ServiceVars) => {
  return {
    isProd: config.APP_ENV === AppEnv.PRD,
    app: {
      name: pkg.name,
      /**
       * This should determine business logic and running environment.
       * @default "local"
       * - expected to be 'local' on local development environment
       * - expected to be 'dev' on dev environment
       * - expected to be 'stage' on stage environment
       * - expected to be 'prod' on prod environment
       */
      env: config.APP_ENV,
      /**
       * This should determine the behavior of the application
       * @default "development"
       * - expected to be 'production' on all deployed environments (dev, stage, prod)
       * - expected to be 'testing' on testing environment
       * - expected to be 'development' on local development environment
       */
      nodeEnv: config.NODE_ENV,
      version: pkg.version,
      port: config.API_PORT,
      swaggerToken: config.SWAGGER_TOKEN,
      /**
       * @default "UTC"
       * - expected to be a valid timezone string
       */
      timezone: config.TZ,
    },
    log: {
      /**
       * Sets the minimum log level (VERBOSE, DEBUG, LOG, WARN, ERROR, FATAL)
       */
      level: config.LOG_LEVEL,
      /**
       * Comma-separated list of fields to mask in logs, e.g. `"token, jwt, password, secret, key"`
       */
      maskFields: config.LOG_MASK_FIELDS,
      /**
       * Comma-separated list of events to filter out from the logs, e.g. `"/api/service/up, /api/service/health"`
       */
      filterEvents: config.LOG_FILTER_EVENTS,
      /**
       * Maximum number of array items to include in logs before truncating
       */
      maxArrayLength: config.LOG_MAX_ARRAY_LENGTH,
    },
    http: {
      /**
       * @default 10000
       */
      timeout: config.HTTP_REQ_TIMEOUT,
      maxRedirects: config.HTTP_REQ_MAX_REDIRECTS,
      /**
       * @default 3
       */
      maxRetries: config.HTTP_REQ_MAX_RETRIES,
      /**
       * @default 1000
       */
      retryDelay: config.HTTP_REQ_RETRY_DELAY,
    },
    service: {
      /**
       * in mb
       *
       * @default 2048
       */
      maxMemoryCheck: config.HEALTH_MAX_MEMORY_MB,
      gracefulShutdownTimeoutMs: config.HEALTH_SHUTDOWN_TIMEOUT_MS,
      routes: {
        base: config.SERVICE_ROUTE,
        health: config.HEALTH_ROUTE,
        liveness: config.LIVENESS_ROUTE,
        config: config.CONFIG_ROUTE,
      },
      commitSha: config.SERVICE_COMMIT_SHA,
      commitMessage: config.SERVICE_COMMIT_MESSAGE,
    },
    slack: {
      botToken: config.SLACK_BOT_TOKEN,
      /**
       * @default "C0948FPCD8W" // iiso-cicd
       */
      channel: config.SLACK_CHANNEL,
    },
  };
};

export type ValidatedServiceConfig = ReturnType<typeof getServiceConfig>;
