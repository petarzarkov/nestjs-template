import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import type { AppConfigService } from '@/config/services/app.config.service';

/**
 * Socket.io adapter with CORS + port config. Single-node in-memory adapter
 * (no Redis) — cross-instance broadcast is out of scope for this template.
 */
export class SocketConfigAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly configService: AppConfigService,
  ) {
    super(app);
  }

  createIOServer(_port: number, options?: ServerOptions) {
    const wsConfig = this.configService.getOrThrow('ws');
    const corsConfig = this.configService.getOrThrow('cors.origin');
    const appConfig = this.configService.getOrThrow('app');

    // Use 0 to share the HTTP server; only create a separate TCP server if
    // wsConfig.port is explicitly set and differs from appConfig.port.
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

    return super.createIOServer(serverPort, serverOptions);
  }
}
