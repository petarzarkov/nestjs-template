import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import pkg from '../../package.json';
import { ConfigValidationError } from './config-validation.error';
import { getDbConfig } from './dto/db-vars.dto';
import { getServiceConfig } from './dto/service-vars.dto';
import { EnvVars } from './env-vars.dto';

export const validateConfig = (config: Record<string, unknown>) => {
  const validatedConfig = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map(error => {
        if (error.constraints) {
          return Object.values(error.constraints).join(', ');
        }
        return `Validation failed for property '${error.property}': No specific message.`;
      })
      .join('\n - ');

    throw new ConfigValidationError(
      `Configuration validation error:\n - ${errorMessages}`,
    );
  }

  return {
    ...getServiceConfig(pkg, validatedConfig),
    ...getDbConfig(validatedConfig),
  } as const;
};

export type ValidatedConfig = ReturnType<typeof validateConfig>;
