import { DynamicModule, Global, Module } from '@nestjs/common';
import { DbType } from '@/config/enum/db-type.enum';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@arkv/nestjs-context-logger';
import { createDrizzleClient, type DrizzleDB } from './client';

/** Nest DI token for the synchronous drizzle client. */
export const DRIZZLE_DB = Symbol('DRIZZLE_DB');

export type { DrizzleDB } from './client';

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: DRIZZLE_DB,
          inject: [AppConfigService, ContextLogger],
          useFactory: (
            configService: AppConfigService<ValidatedConfig>,
            logger: ContextLogger,
          ): DrizzleDB => {
            const dbConfig = configService.getOrThrow('db');
            if (dbConfig.type === DbType.POSTGRES) {
              throw new Error(
                'DB_TYPE=postgres is not supported by this SQLite-first template: the data layer is synchronous (bun:sqlite). Set DB_TYPE=sqlite.',
              );
            }
            const { db } = createDrizzleClient(dbConfig.sqlitePath);
            logger.log(
              `SQLite database initialized at ${dbConfig.sqlitePath} (WAL, foreign_keys=ON)`,
            );
            return db;
          },
        },
      ],
      exports: [DRIZZLE_DB],
    };
  }
}
