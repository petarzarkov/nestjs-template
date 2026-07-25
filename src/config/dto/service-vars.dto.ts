import { z } from 'zod';
import { LogLevel } from '@arkv/nestjs-context-logger';
import { LOGGER, SECOND } from '../../constants';
import { AppEnv } from '../enum/app-env.enum';
import { PackageJson } from '../PackageJson';
import { wsVarsSchema } from './ws-vars.dto';

/** Comma-separated env string → trimmed array, with a fallback default. */
const csv = (fallback: string[]) =>
  z
    .string()
    .optional()
    .transform(value =>
      typeof value === 'string'
        ? value.split(',').map(v => v.trim())
        : fallback,
    );

const timezone = z
  .string()
  .default('UTC')
  .refine(tz => {
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Invalid IANA timezone');

export const serviceVarsSchema = z.object({
  ...wsVarsSchema.shape,

  APP_ENV: z.enum(AppEnv).default(AppEnv.LOCAL),
  NODE_ENV: z
    .enum(['development', 'testing', 'production'])
    .default('development'),
  LOG_LEVEL: z.enum(LogLevel).default(LogLevel.DEBUG),
  LOG_MASK_FIELDS: csv([...LOGGER.defaultMaskFields]),
  LOG_FILTER_EVENTS: csv([...LOGGER.defaultFilterEvents]),
  LOG_MAX_ARRAY_LENGTH: z.coerce.number().min(1).max(1000).default(1),

  API_PORT: z.coerce.number().min(0).max(65535),
  BASIC_AUTH_TOKEN: z.string().optional(),

  HTTP_REQ_TIMEOUT: z.coerce.number().default(30000),
  HTTP_REQ_MAX_REDIRECTS: z.coerce.number().default(5),
  HTTP_REQ_MAX_RETRIES: z.coerce.number().default(3),
  HTTP_REQ_RETRY_DELAY: z.coerce.number().default(SECOND),

  SERVICE_ROUTE: z.string().default('service'),
  HEALTH_ROUTE: z.string().default('health'),
  LIVENESS_ROUTE: z.string().default('up'),
  CONFIG_ROUTE: z.string().default('config'),
  HEALTH_MAX_MEMORY_MB: z.coerce.number().default(2048),
  HEALTH_SHUTDOWN_TIMEOUT_MS: z.coerce.number().default(10000),
  SERVICE_COMMIT_SHA: z.string().optional(),
  SERVICE_COMMIT_MESSAGE: z.string().optional(),

  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_CHANNEL: z.string().default('C0948FPCD8W'),

  TZ: timezone,

  BETTER_AUTH_SECRET: z.string(),
  AUTH_SESSION_EXPIRATION: z.coerce.number().min(1).max(604800).default(86400),
  AUTH_SESSION_UPDATE_AGE: z.coerce.number().min(1).max(604800).default(3600),

  CORS_ORIGIN: z.string().default('*'),

  EMAIL_API_KEY: z.string().optional(),
  EMAIL_SENDER: z.string().optional(),
  EMAIL_ADMIN: z.string().optional(),

  WEB_URL: z.string().optional(),
  LOGO_URL: z
    .string()
    .default(
      'https://cdn.betterttv.net/emote/5590b223b344e2c42a9e28e3/1x.webp',
    ),
});

export type ServiceVars = z.infer<typeof serviceVarsSchema>;

export const getServiceConfig = (pkg: PackageJson, config: ServiceVars) => {
  return {
    isProd: config.APP_ENV === AppEnv.PRD,
    app: {
      webUrl: config.WEB_URL || `http://localhost:${config.API_PORT}`,
      name: pkg.name,
      env: config.APP_ENV,
      nodeEnv: config.NODE_ENV,
      version: pkg.version,
      port: config.API_PORT,
      basicAuthToken: config.BASIC_AUTH_TOKEN,
      timezone: config.TZ,
      logoUrl: config.LOGO_URL,
    },
    log: {
      level: config.LOG_LEVEL,
      maskFields: config.LOG_MASK_FIELDS,
      filterEvents: config.LOG_FILTER_EVENTS,
      maxArrayLength: config.LOG_MAX_ARRAY_LENGTH,
    },
    http: {
      timeout: config.HTTP_REQ_TIMEOUT,
      maxRedirects: config.HTTP_REQ_MAX_REDIRECTS,
      maxRetries: config.HTTP_REQ_MAX_RETRIES,
      retryDelay: config.HTTP_REQ_RETRY_DELAY,
    },
    service: {
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
      channel: config.SLACK_CHANNEL,
    },
    auth: {
      secret: config.BETTER_AUTH_SECRET,
      sessionExpiresIn: config.AUTH_SESSION_EXPIRATION,
      sessionUpdateAge: config.AUTH_SESSION_UPDATE_AGE,
    },
    ws: {
      connectTimeout: config.WS_CONNECT_TIMEOUT,
      pingInterval: config.WS_PING_INTERVAL,
      pingTimeout: config.WS_PING_TIMEOUT,
      cleanupEmptyChildNamespaces: config.WS_CLEANUP_EMPTY_CHILD_NAMESPACES,
      path: config.WS_PATH,
      port: config.WS_PORT,
    },
    cors: {
      origin: config.CORS_ORIGIN,
    },
    email: {
      apiKey: config.EMAIL_API_KEY,
      sender: config.EMAIL_SENDER || 'no-reply@ggg.com',
      adminEmail: config.EMAIL_ADMIN || 'admin@gmail.com',
      maxPerSecond: 2,
    },
  };
};

export type ValidatedServiceConfig = ReturnType<typeof getServiceConfig>;
