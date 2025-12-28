import { plainToInstance, Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidationError,
  validateSync,
} from 'class-validator';
import { MINUTE, SECOND } from '@/constants';
import { ConfigValidationError } from '../config-validation.error';

export class RedisVars {
  @IsString()
  REDIS_HOST!: string;

  @IsNumber()
  @Min(0)
  @Max(65535)
  @IsOptional()
  REDIS_PORT: number = 6383;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @Min(0)
  @Max(15)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 0))
  REDIS_DB: number = 0;

  @IsNumber()
  @Min(SECOND)
  @Max(MINUTE)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 30000))
  REDIS_CACHE_TTL: number = 30000; // 30 seconds in ms

  @IsNumber()
  @Min(1000)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : MINUTE))
  REDIS_THROTTLE_TTL: number = MINUTE;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 100))
  REDIS_THROTTLE_LIMIT: number = 100; // requests per TTL

  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 3))
  REDIS_QUEUES_MAX_RETRIES: number = 3;

  @IsNumber()
  @Min(100)
  @Max(60000)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 5000))
  REDIS_QUEUES_RETRY_DELAY_MS: number = 5000;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 10))
  REDIS_QUEUES_CONCURRENCY: number = 10;

  @IsNumber()
  @Min(1)
  @Max(1000)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 100))
  REDIS_QUEUES_RATE_LIMIT_MAX: number = 100;

  @IsNumber()
  @Min(100)
  @Max(60000)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : SECOND))
  REDIS_QUEUES_RATE_LIMIT_DURATION: number = SECOND;
}

export const getRedisConfig = (config: RedisVars) => {
  return {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
    db: config.REDIS_DB,
    cache: {
      ttl: config.REDIS_CACHE_TTL,
    },
    throttle: {
      ttl: config.REDIS_THROTTLE_TTL,
      limit: config.REDIS_THROTTLE_LIMIT,
    },
    queues: {
      maxRetries: config.REDIS_QUEUES_MAX_RETRIES,
      retryDelayMs: config.REDIS_QUEUES_RETRY_DELAY_MS,
      concurrency: config.REDIS_QUEUES_CONCURRENCY,
      rateLimitMax: config.REDIS_QUEUES_RATE_LIMIT_MAX,
      rateLimitDuration: config.REDIS_QUEUES_RATE_LIMIT_DURATION,
    },
  };
};

export const validateRedisConfig = (config: Record<string, unknown>) => {
  const validatedConfig = plainToInstance(RedisVars, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: true,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error: ValidationError) => {
        if (error.constraints) {
          return Object.values(error.constraints).join(', ');
        }
        return `Validation failed for property '${error.property}': No specific message.`;
      })
      .join('\n - ');

    throw new ConfigValidationError(
      `Redis configuration validation error:\n - ${errorMessages}`,
    );
  }

  return getRedisConfig(validatedConfig);
};

export type ValidatedRedisConfig = NonNullable<
  ReturnType<typeof getRedisConfig>
>;
