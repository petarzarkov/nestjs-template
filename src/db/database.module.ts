import fs from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';
import { DataSource } from 'typeorm';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { SnakeNamingStrategy } from './strategies/snake-case.strategy';

/**
 * Database module for initializing database connections.
 * Supports optional Redis caching when REDIS_HOST and REDIS_CACHE_ENABLED are set.
 */
@Module({})
export class DatabaseModule {
  static logger?: ContextLogger;

  static forRoot(): DynamicModule {
    return TypeOrmModule.forRootAsync({
      inject: [AppConfigService, ContextLogger],
      useFactory: (
        configService: AppConfigService<ValidatedConfig>,
        logger: ContextLogger,
      ) => {
        const dbConfig = configService.getOrThrow('db');
        const appConfig = configService.getOrThrow('app');
        const redisConfig = configService.get('redis');
        DatabaseModule.logger = logger;

        // Configure Redis cache if enabled
        const cacheConfig =
          redisConfig?.cacheEnabled && redisConfig.host
            ? {
                cache: {
                  type: 'ioredis' as const,
                  options: {
                    host: redisConfig.host,
                    port: redisConfig.port,
                    password: redisConfig.password,
                    db: redisConfig.db,
                  },
                  duration: 30000, // 30 seconds default TTL
                },
              }
            : {};

        if (redisConfig?.cacheEnabled) {
          logger.log('TypeORM Redis cache enabled', {
            host: redisConfig.host,
            port: redisConfig.port,
          });
        }

        return {
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
                  ca: fs.readFileSync(join(cwd(), dbConfig.caPath)).toString(),
                }
              : false,
          synchronize: false,
          autoLoadEntities: true,
          namingStrategy: new SnakeNamingStrategy(),
          retryAttempts: dbConfig.retries,
          retryDelay: dbConfig.retryDelay,
          toRetry: (error: unknown) => {
            logger.error(
              `Database connection failed for default db ${dbConfig.name}:${dbConfig.host}:${dbConfig.port}`,
              { error },
            );
            return true;
          },
          verboseRetryLog: true,
          ...cacheConfig,
        };
      },
      dataSourceFactory: async options => {
        if (!options) {
          throw new Error('DataSource options are required');
        }
        const dataSource = new DataSource(options);
        await dataSource.initialize();
        DatabaseModule.logger?.log(
          `Database connection initialized for default db`,
        );
        return dataSource;
      },
    });
  }

  static forFeature(models: EntityClassOrSchema[]): DynamicModule {
    return TypeOrmModule.forFeature(models);
  }
}
