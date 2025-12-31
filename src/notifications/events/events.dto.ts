import type { DefaultEventsMap } from 'socket.io';
import { Server, Socket } from 'socket.io';
import { AIProvider } from '@/ai/enum/ai-provider.enum';
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

export class BaseUserEvent {
  username!: string;
  timestamp!: Date;
}

export class ChatMessage extends BaseUserEvent {
  message!: string;
  picture!: string | null;
}

export class AIMessageRequest {
  provider!: AIProvider;
  model!: string;
  prompt!: string;
}

export class AIMessageChunk {
  requestId!: string;
  chunk!: string;
  provider!: AIProvider;
  model!: string;
  done!: boolean;
  username!: string;
}

export class AIMessageError {
  requestId!: string;
  error!: string;
  provider!: AIProvider;
  model!: string;
  username!: string;
}

export interface WebSocketEmitEvents {
  connected: (message: WebSocketBaseMessage<SanitizedUser>) => void;
  exception: (message: WebSocketBaseMessage) => void;
  notification: (
    message: WebSocketMessage<EventType, EventMap[EventType]>,
  ) => void;
  global_notification: (message: WebSocketBaseMessage) => void;
  userJoined: (data: BaseUserEvent) => void;
  userLeft: (data: BaseUserEvent) => void;
  userCount: (count: number) => void;
  message: (data: ChatMessage) => void;
  aiMessageChunk: (data: AIMessageChunk) => void;
  aiError: (data: AIMessageError) => void;
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
