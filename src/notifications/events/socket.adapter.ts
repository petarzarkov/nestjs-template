import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { ServerOptions } from 'socket.io';
import type { ValidatedConfig } from '@/config/env.validation';
import type { AppConfigService } from '@/config/services/app.config.service';

export class SocketConfigAdapter extends IoAdapter {
  private pubClient?: Redis;
  private subClient?: Redis;

  constructor(
    app: INestApplicationContext,
    private readonly configService: AppConfigService<ValidatedConfig>,
  ) {
    super(app);
  }

  createIOServer(_port: number, options?: ServerOptions) {
    const wsConfig = this.configService.getOrThrow('ws');
    const corsConfig = this.configService.getOrThrow('cors.origin');
    const appConfig = this.configService.getOrThrow('app');
    const redisConfig = this.configService.get('redis');

    // Use 0 to share the HTTP server; only create a separate TCP server if wsConfig.port is explicitly set and differs from appConfig.port
    const serverPort =
      wsConfig.port && wsConfig.port !== appConfig.port ? wsConfig.port : 0;

    const serverOptions: ServerOptions = {
      ...(options as ServerOptions),
      cors: {
        origin: corsConfig,
        credentials: appConfig.nodeEnv === 'production',
      },
      ...wsConfig,
    };

    // Create the server with the specific port and options
    const server = super.createIOServer(serverPort, serverOptions);

    // Apply Redis adapter
    this.pubClient = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
    });
    this.subClient = this.pubClient.duplicate();

    server.adapter(createAdapter(this.pubClient, this.subClient));

    return server;
  }

  override async close(server: ReturnType<typeof this.createIOServer>) {
    this.pubClient?.disconnect();
    this.subClient?.disconnect();
    return super.close(server);
  }
}
