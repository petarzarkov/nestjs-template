import { z } from 'zod';
import { DbType } from '../enum/db-type.enum';

/**
 * Cross-field rules (POSTGRES_* required when DB_TYPE=postgres, CA path when
 * SSL) are enforced by the merged env schema's superRefine in `env-vars.dto`.
 */
export const dbVarsSchema = z.object({
  DB_TYPE: z.enum(DbType).default(DbType.SQLITE),
  SQLITE_DB_PATH: z.string().default('./data/app.db'),
  POSTGRES_DB: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_HOST: z.string().optional(),
  POSTGRES_PORT: z.coerce.number().min(0).max(65535).default(5438),
  POSTGRES_USE_SSL: z.stringbool().default(false),
  POSTGRES_CA_PATH: z.string().optional(),
  CONNECTION_RETRIES: z.coerce.number().min(0).max(60).default(60),
  CONNECTION_RETRY_DELAY: z.coerce.number().min(0).max(7500).default(7500),
});

export type DbVars = z.infer<typeof dbVarsSchema>;

export const getDbConfig = (config: DbVars) => {
  return {
    db: {
      type: config.DB_TYPE,
      sqlitePath: config.SQLITE_DB_PATH,
      host: config.POSTGRES_HOST,
      port: config.POSTGRES_PORT,
      user: config.POSTGRES_USER,
      pass: config.POSTGRES_PASSWORD,
      name: config.POSTGRES_DB,
      useSsl: config.POSTGRES_USE_SSL,
      caPath: config.POSTGRES_CA_PATH,
      retries: config.CONNECTION_RETRIES,
      retryDelay: config.CONNECTION_RETRY_DELAY,
    },
  };
};

export type ValidatedDbConfig = ReturnType<typeof getDbConfig>;
