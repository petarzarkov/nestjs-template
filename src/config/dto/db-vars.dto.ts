import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  validateSync,
  ValidationError,
} from 'class-validator';
import { ConfigValidationError } from '../env.validation';

export class DbVars {
  @IsString()
  POSTGRES_DB!: string;

  @IsString()
  POSTGRES_USER!: string;

  @IsString()
  POSTGRES_PASSWORD!: string;

  @IsString()
  POSTGRES_HOST!: string;

  @IsNumber()
  @Min(0)
  @Max(65535)
  @IsOptional()
  POSTGRES_PORT: number = 5432;

  @IsBoolean()
  @IsOptional()
  @Transform(({ obj }) => {
    return obj.POSTGRES_USE_SSL === 'true';
  })
  POSTGRES_USE_SSL?: boolean;

  @ValidateIf((vars: DbVars) => !!vars.POSTGRES_USE_SSL)
  @IsString({
    message: 'POSTGRES_CA_PATH needs to be defined when POSTGRES_USE_SSL is true.',
  })
  POSTGRES_CA_PATH!: string;
}

export const getDbConfig = (config: DbVars) => {
  return {
    db: {
      host: config.POSTGRES_HOST,
      port: config.POSTGRES_PORT,
      user: config.POSTGRES_USER,
      pass: config.POSTGRES_PASSWORD,
      name: config.POSTGRES_DB,
      useSsl: config.POSTGRES_USE_SSL,
      caPath: config.POSTGRES_CA_PATH,
    },
  };
};

export const validateDbConfig = (config: Record<string, unknown>) => {
  const validatedConfig = plainToInstance(DbVars, config, {
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

    throw new ConfigValidationError(`Configuration validation error:\n - ${errorMessages}`);
  }

  return getDbConfig(validatedConfig);
};

export type ValidatedDbConfig = ReturnType<typeof getDbConfig>;
