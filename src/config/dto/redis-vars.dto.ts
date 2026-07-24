import { z } from 'zod';
import { MINUTE, SECOND } from '@/constants';

/**
 * Redis connection + BullMQ queue tuning + REST cache TTL. Consumed as the
 * `redis` config group. BullMQ, the Socket.io Redis adapter, the throttler
 * storage and the cache-manager store all build their own ioredis connections
 * from `host`/`port`/`password`/`db`.
 */
export const redisVarsSchema = z.object({
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().min(0).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().min(0).max(15).default(0),

  REDIS_CACHE_TTL: z.coerce
    .number()
    .min(SECOND)
    .max(MINUTE)
    .default(5 * SECOND),

  REDIS_QUEUES_MAX_RETRIES: z.coerce.number().min(1).max(10).default(3),
  REDIS_QUEUES_RETRY_DELAY_MS: z.coerce
    .number()
    .min(100)
    .max(60_000)
    .default(5 * SECOND),
  REDIS_QUEUES_CONCURRENCY: z.coerce.number().min(1).max(100).default(3),
  REDIS_QUEUES_RATE_LIMIT_MAX: z.coerce.number().min(1).max(1000).default(100),
  REDIS_QUEUES_RATE_LIMIT_DURATION: z.coerce
    .number()
    .min(100)
    .max(60_000)
    .default(SECOND),
  REDIS_QUEUES_JOB_TIMEOUT_MS: z.coerce
    .number()
    .min(10 * SECOND)
    .max(10 * MINUTE)
    .default(2 * MINUTE),
});

export type RedisVars = z.infer<typeof redisVarsSchema>;

export const getRedisConfig = (config: RedisVars) => {
  return {
    redis: {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,
      db: config.REDIS_DB,
      cache: { ttl: config.REDIS_CACHE_TTL },
      queues: {
        jobTimeoutMs: config.REDIS_QUEUES_JOB_TIMEOUT_MS,
        maxRetries: config.REDIS_QUEUES_MAX_RETRIES,
        retryDelayMs: config.REDIS_QUEUES_RETRY_DELAY_MS,
        concurrency: config.REDIS_QUEUES_CONCURRENCY,
        rateLimitMax: config.REDIS_QUEUES_RATE_LIMIT_MAX,
        rateLimitDuration: config.REDIS_QUEUES_RATE_LIMIT_DURATION,
      },
    },
  };
};

export type ValidatedRedisConfig = ReturnType<typeof getRedisConfig>;
