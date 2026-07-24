import type { DynamicModule } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

/**
 * Global module exposing the WebSocket gateway. The gateway authenticates via
 * the (global) Better Auth `AuthService`; all its other deps (logger, context,
 * AIService, RedisService) come from global modules.
 */
export class EventsModule {
  static forRoot(): DynamicModule {
    return {
      module: EventsModule,
      global: true,
      providers: [EventsGateway],
      exports: [EventsGateway],
    };
  }
}
