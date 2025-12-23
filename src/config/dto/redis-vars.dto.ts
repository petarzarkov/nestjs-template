import { plainToInstance, Transform } from 'class-transformer';
import {
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
  REDIS_HOST!: string;

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
}

export const getRedisConfig = (config: RedisVars) => {
  return {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
    db: config.REDIS_DB,
  };
};

export const validateRedisConfig = (config: Record<string, unknown>) => {
  const validatedConfig = plainToInstance(RedisVars, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
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

export type ValidatedRedisConfig = ReturnType<typeof getRedisConfig>;
