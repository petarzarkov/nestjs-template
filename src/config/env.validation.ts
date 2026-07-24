import { GLOBAL_PREFIX } from '@/constants';
import pkg from '../../package.json';
import { ConfigValidationError } from './config-validation.error';
import { getAIConfig } from './dto/ai-vars.dto';
import { getDbConfig } from './dto/db-vars.dto';
import { getOAuthConfig } from './dto/oauth-vars.dto';
import { getRedisConfig } from './dto/redis-vars.dto';
import { getServiceConfig } from './dto/service-vars.dto';
import { envSchema } from './env-vars.dto';

export const validateConfig = (config: Record<string, unknown>) => {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n - ');

    throw new ConfigValidationError(
      `Configuration validation error:\n - ${errorMessages}`,
    );
  }

  const validatedConfig = parsed.data;
  const serviceConfig = getServiceConfig(pkg, validatedConfig);

  return {
    ...serviceConfig,
    ...getDbConfig(validatedConfig),
    ...getRedisConfig(validatedConfig),
    oauth: getOAuthConfig(
      validatedConfig,
      serviceConfig.app.webUrl,
      GLOBAL_PREFIX,
    ),
    ai: getAIConfig(validatedConfig),
    aws: {
      s3BucketName: validatedConfig.AWS_S3_BUCKET_NAME,
      region: validatedConfig.AWS_REGION,
      accessKeyId: validatedConfig.AWS_ACCESS_KEY_ID,
      secretAccessKey: validatedConfig.AWS_SECRET_ACCESS_KEY,
    },
  } as const;
};

export type ValidatedConfig = ReturnType<typeof validateConfig>;
