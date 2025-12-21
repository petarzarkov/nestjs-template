import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [AppConfigService<ValidatedConfig>],
      useFactory: async (config: AppConfigService<ValidatedConfig>) => {
        const db = config.getOrThrow('db');

        const pool = new Pool({
          host: db.host,
          port: db.port,
          user: db.user,
          password: db.pass,
          database: db.name,
          max: 20, // Limit connection count to prevent starvation
          idleTimeoutMillis: 30000,
          ssl: db.useSsl
            ? {
                ca: db.caPath ? require('fs').readFileSync(db.caPath).toString() : undefined,
                rejectUnauthorized: true,
              }
            : false,
        });

        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
