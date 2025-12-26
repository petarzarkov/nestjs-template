import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GLOBAL_PREFIX } from '@/constants';
import pkg from '../../package.json';
import { ConfigValidationError } from './config-validation.error';
import { getDbConfig } from './dto/db-vars.dto';
import { getOAuthConfig } from './dto/oauth-vars.dto';
import { getRedisConfig } from './dto/redis-vars.dto';
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

  const serviceConfig = getServiceConfig(pkg, validatedConfig);
  return {
    ...serviceConfig,
    ...getDbConfig(validatedConfig),
    redis: getRedisConfig(validatedConfig),
    oauth: getOAuthConfig(
      validatedConfig,
      serviceConfig.app.webUrl,
      GLOBAL_PREFIX,
    ),
  } as const;
};

export type ValidatedConfig = ReturnType<typeof validateConfig>;
