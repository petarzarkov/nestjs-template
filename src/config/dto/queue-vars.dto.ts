import { z } from 'zod';

/**
 * bunqueue (SQLite-backed) queue tuning. Replaces the former Redis/BullMQ
 * `REDIS_QUEUES_*` settings — no Redis involved.
 */
export const queueVarsSchema = z.object({
  QUEUE_DATA_PATH: z.string().default('./data/queue'),
  QUEUE_CONCURRENCY: z.coerce.number().min(1).default(5),
  QUEUE_MAX_RETRIES: z.coerce.number().min(0).default(3),
  QUEUE_RETRY_DELAY_MS: z.coerce.number().min(0).default(1000),
  QUEUE_JOB_TIMEOUT_MS: z.coerce.number().min(1000).default(30000),
  QUEUE_RATE_LIMIT_MAX: z.coerce.number().min(1).default(100),
  QUEUE_RATE_LIMIT_DURATION: z.coerce.number().min(1).default(1000),
});

export type QueueVars = z.infer<typeof queueVarsSchema>;

export const getQueueConfig = (config: QueueVars) => {
  return {
    queue: {
      dataPath: config.QUEUE_DATA_PATH,
      concurrency: config.QUEUE_CONCURRENCY,
      maxRetries: config.QUEUE_MAX_RETRIES,
      retryDelayMs: config.QUEUE_RETRY_DELAY_MS,
      jobTimeoutMs: config.QUEUE_JOB_TIMEOUT_MS,
      rateLimitMax: config.QUEUE_RATE_LIMIT_MAX,
      rateLimitDuration: config.QUEUE_RATE_LIMIT_DURATION,
    },
  };
};

export type ValidatedQueueConfig = ReturnType<typeof getQueueConfig>;
