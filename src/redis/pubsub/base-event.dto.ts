import type { EventMap, EventType } from '@/notifications/events/events';

export interface BaseEvent<T extends EventType> {
  eventId: string;
  timestamp: string;
  requestId?: string;
  eventType: T;
  payload: EventMap[T];
  metadata?: {
    userId?: string;
    emitToAdmins?: boolean;
  };
}
