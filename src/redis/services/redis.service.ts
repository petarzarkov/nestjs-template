import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@/logger/services/context-logger.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  redisClient: Redis;

  constructor(
    private readonly configService: AppConfigService<ValidatedConfig>,
    private readonly logger: ContextLogger,
  ) {
    const redisConfig = this.configService.getOrThrow('redis');

    const client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      retryStrategy: (times: number) => {
        this.logger.warn(`Redis retry attempt ${times}...`);
        return Math.min(times * 1000, 5000);
      },
      ...(redisConfig.password && { password: redisConfig.password }),
      ...(redisConfig.db && { db: redisConfig.db }),
    });

    client.on('connect', () =>
      this.logger.log(
        `Attempting to connect to Redis at ${redisConfig.host}:${redisConfig.port}...`,
      ),
    );
    client.on('ready', () => this.logger.log('Redis client ready.'));
    client.on('reconnecting', () =>
      this.logger.verbose('Redis client reconnecting...'),
    );
    client.on('error', err =>
      this.logger.error('Redis Client Error', { error: err }),
    );
    client.on('end', () =>
      this.logger.verbose('Redis client connection ended.'),
    );

    this.redisClient = client;
  }

  async onModuleInit() {
    // Check if we are already connected/ready to avoid hanging listeners
    if (['ready', 'connect'].includes(this.redisClient.status)) {
      this.logger.log('Redis client is already initializing or ready.');
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        // Cleanup listeners to avoid memory leaks if this service is re-initialized
        const cleanup = () => {
          this.redisClient.off('ready', onReady);
          this.redisClient.off('error', onError);
        };
        const onReady = () => {
          cleanup();
          resolve();
        };
        const onError = (err: Error) => {
          cleanup();
          reject(err);
        };

        if (this.redisClient.status === 'ready') {
          resolve();
          return;
        }

        this.redisClient.once('ready', onReady);
        this.redisClient.once('error', onError);
      });
      this.logger.log('Redis client successfully connected and ready.');
    } catch (err) {
      this.logger.error(
        'Failed to connect Redis client during module initialization.',
        { err },
      );
      throw err;
    }
  }
  async onModuleDestroy() {
    this.logger.log('Disconnecting Redis client on module destroy...');
    try {
      if (this.redisClient.status === 'ready') {
        await this.redisClient.quit();
        this.logger.log('Redis client disconnected successfully.');
      } else {
        this.logger.log('Redis client already disconnected or quit.');
      }
    } catch (err) {
      this.logger.error('Error disconnecting Redis client:', { err });
    }
  }
}
