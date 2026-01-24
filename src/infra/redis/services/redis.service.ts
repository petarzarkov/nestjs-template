import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis, RedisOptions } from 'ioredis';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly managedClients: Map<string, Redis> = new Map();

  constructor(
    private readonly configService: AppConfigService,
    private readonly logger: ContextLogger,
  ) {}

  newConnection(name: string, optionsOverride: RedisOptions = {}): Redis {
    if (this.managedClients.has(name)) {
      // biome-ignore lint/style/noNonNullAssertion: we know the client has an entry in the map
      return this.managedClients.get(name)!;
    }

    const redisConfig = this.configService.getOrThrow('redis');

    const client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      ...(redisConfig.password && { password: redisConfig.password }),
      ...(redisConfig.db && { db: redisConfig.db }),
      ...optionsOverride,
      retryStrategy: (times: number) => {
        if (times > 3) {
          this.logger.log(
            `Redis ${name} connection retry attempt ${times}... @db: ${client.options.db ?? 0}`,
          );
        }
        return Math.min(times * 1000, 5000);
      },
    });

    this.bindClientEvents(name, client);
    this.managedClients.set(name, client);

    return client;
  }

  async onModuleDestroy() {
    this.logger.log(
      `Disconnecting ${this.managedClients.size} Redis clients...`,
    );

    const closePromises = Array.from(this.managedClients.entries()).map(
      async ([name, client]) => {
        try {
          if (['ready', 'connect', 'reconnecting'].includes(client.status)) {
            await client.quit();
          }
        } catch (err) {
          this.logger.error(
            `Error disconnecting a Redis ${name} client @db: ${client.options.db ?? 0}`,
            {
              err,
            },
          );
          client.disconnect();
        }
      },
    );

    await Promise.all(closePromises);
    this.logger.log('All Redis clients disconnected successfully.');
  }

  private bindClientEvents(name: string, client: Redis) {
    client.on('connect', () => {});

    client.on('ready', () => {
      const db = client.options.db ?? 0;
      this.logger.verbose(`Redis ${name} client ready (DB: ${db})`);
    });

    client.on('error', err =>
      this.logger.error(
        `Redis ${name} client error @db: ${client.options.db ?? 0}`,
        { error: err },
      ),
    );
  }
}
