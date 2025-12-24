import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
  ValidationError,
} from 'class-validator';
import { ConfigValidationError } from '../config-validation.error';

export class RedisVars {
  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsNumber()
  @Min(0)
  @Max(65535)
  @IsOptional()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @Min(0)
  @Max(15)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 0))
  REDIS_DB: number = 0;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  REDIS_CACHE_ENABLED: boolean = false;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  REDIS_THROTTLE_ENABLED: boolean = false;

  @IsNumber()
  @Min(1000)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 60000))
  REDIS_THROTTLE_TTL: number = 60000; // 60 seconds in ms

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 100))
  REDIS_THROTTLE_LIMIT: number = 100; // requests per TTL

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  REDIS_WS_ADAPTER_ENABLED: boolean = false;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  REDIS_PUBSUB_ENABLED: boolean = false;
}

export const getRedisConfig = (config: RedisVars) => {
  // Only return config if REDIS_HOST is defined
  if (!config.REDIS_HOST) {
    return undefined;
  }

  return {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
    db: config.REDIS_DB,
    cacheEnabled: config.REDIS_CACHE_ENABLED,
    throttleEnabled: config.REDIS_THROTTLE_ENABLED,
    throttleTtl: config.REDIS_THROTTLE_TTL,
    throttleLimit: config.REDIS_THROTTLE_LIMIT,
    wsAdapterEnabled: config.REDIS_WS_ADAPTER_ENABLED,
    pubsubEnabled: config.REDIS_PUBSUB_ENABLED,
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
