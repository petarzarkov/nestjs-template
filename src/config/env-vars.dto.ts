import { z } from 'zod';
import { aiVarsSchema } from './dto/ai-vars.dto';
import { awsVarsSchema } from './dto/aws-vars.dto';
import { dbVarsSchema } from './dto/db-vars.dto';
import { oauthVarsSchema } from './dto/oauth-vars.dto';
import { redisVarsSchema } from './dto/redis-vars.dto';
import { serviceVarsSchema } from './dto/service-vars.dto';
import { AppEnv } from './enum/app-env.enum';
import { DbType } from './enum/db-type.enum';

/** All env vars, merged, with cross-field rules. */
export const envSchema = z
  .object({
    ...dbVarsSchema.shape,
    ...serviceVarsSchema.shape,
    ...redisVarsSchema.shape,
    ...oauthVarsSchema.shape,
    ...aiVarsSchema.shape,
    ...awsVarsSchema.shape,
  })
  .superRefine((data, ctx) => {
    if (data.DB_TYPE === DbType.POSTGRES) {
      for (const key of [
        'POSTGRES_DB',
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_HOST',
      ] as const) {
        if (!data[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when DB_TYPE=postgres`,
          });
        }
      }
      if (data.POSTGRES_USE_SSL && !data.POSTGRES_CA_PATH) {
        ctx.addIssue({
          code: 'custom',
          path: ['POSTGRES_CA_PATH'],
          message: 'POSTGRES_CA_PATH is required when POSTGRES_USE_SSL is true',
        });
      }
    }

    if (
      [AppEnv.STG, AppEnv.PRD].includes(data.APP_ENV) &&
      !data.BASIC_AUTH_TOKEN
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['BASIC_AUTH_TOKEN'],
        message: 'BASIC_AUTH_TOKEN is required when APP_ENV is stage or prod',
      });
    }
  });

export type EnvVars = z.infer<typeof envSchema>;
