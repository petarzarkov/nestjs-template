import type { DefaultEventsMap } from 'socket.io';
import { Server, Socket } from 'socket.io';
import type { EventMap, EventType } from '@/notifications/events/events';
import type { SanitizedUser } from '@/users/entity/user.entity';

export class WebSocketBaseMessage<T = unknown> {
  message!: string;
  payload!: T;
}

export class WebSocketMessage<Key extends EventType, T extends EventMap[Key]> {
  event!: Key;
  payload!: T;
}

export interface WebSocketEmitEvents {
  connected: (message: WebSocketBaseMessage<SanitizedUser>) => void;
  exception: (message: WebSocketBaseMessage) => void;
  notification: (
    message: WebSocketMessage<EventType, EventMap[EventType]>,
  ) => void;
  global_notification: (message: WebSocketBaseMessage) => void;
}

export type EmitToClient = <K extends keyof WebSocketEmitEvents>(
  ev: K,
  message: Parameters<WebSocketEmitEvents[K]>[0],
) => void;

export class ExtendedSocket extends Socket<
  DefaultEventsMap,
  WebSocketEmitEvents,
  DefaultEventsMap,
  { user: SanitizedUser }
> {}

export class WSServer extends Server<
  DefaultEventsMap,
  WebSocketEmitEvents,
  DefaultEventsMap,
  { user: SanitizedUser }
> {}
