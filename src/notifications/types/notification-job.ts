import type { EventMap } from '../events/events';

export type NotificationJob<T extends keyof EventMap = keyof EventMap> = {
  eventType: T;
  payload: EventMap[T];
  metadata?: {
    userId?: string;
    requestId?: string;
    emitToAdmins?: boolean;
  };
};
