import { ValidatedDbConfig } from '@/config/dto/db-vars.dto';
import { ValidatedServiceConfig } from '@/config/dto/service-vars.dto';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';
import fs from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from './strategies/snake-case.strategy';

interface DatabaseModuleOptions {
  /**
   * An array of connection names to initialize multiple database connections.
   * If not provided, it will default to ['default'].
   */
  connections: string[];
}

/**
 * Database module for initializing multiple database connections.
 */
@Module({})
export class DatabaseModule {
  static logger?: ContextLogger;

  static forRoot(options?: DatabaseModuleOptions): DynamicModule {
    const { connections } = options || { connections: ['default'] };

    const typeOrmModules = connections.map(connectionName =>
      TypeOrmModule.forRootAsync({
        name: connectionName,
        inject: [AppConfigService, ContextLogger],
        useFactory: (
          configService: AppConfigService<
            ValidatedDbConfig & ValidatedServiceConfig
          >,
          logger: ContextLogger,
        ) => {
          const dbConfig = configService.getOrThrow('db');
          const appConfig = configService.getOrThrow('app');
          this.logger = logger;
          return {
            name: connectionName,
            type: 'postgres',
            host: dbConfig.host,
            port: dbConfig.port,
            username: dbConfig.user,
            password: dbConfig.pass,
            database: dbConfig.name,
            timezone: appConfig.timezone,
            ssl:
              dbConfig.useSsl && dbConfig.caPath
                ? {
                    ca: fs
                      .readFileSync(join(cwd(), dbConfig.caPath))
                      .toString(),
                  }
                : false,
            synchronize: false,
            autoLoadEntities: true,
            namingStrategy: new SnakeNamingStrategy(),
            retryAttempts: dbConfig.retries,
            retryDelay: dbConfig.retryDelay,
            toRetry: (error: unknown) => {
              logger.error(
                `Database connection failed for (${connectionName}) db ${dbConfig.name}:${dbConfig.host}:${dbConfig.port}`,
                { error },
              );
              return true;
            },
            verboseRetryLog: true,
          };
        },
        dataSourceFactory: async options => {
          if (!options) {
            throw new Error('DataSource options are required');
          }
          const dataSource = new DataSource(options);
          await dataSource.initialize();
          this.logger?.log(
            `Database connection initialized for (${connectionName}) db`,
          );
          return dataSource;
        },
      }),
    );

    return {
      module: DatabaseModule,
      imports: typeOrmModules,
      exports: [TypeOrmModule],
    };
  }

  static forFeature(
    models: EntityClassOrSchema[],
    connectionName: string = 'default',
  ): DynamicModule {
    return TypeOrmModule.forFeature(models, connectionName);
  }
}
