import { Job } from 'bullmq';
import type { EventMap, EventType } from '@/notifications/events/events';

export interface BaseJob<T extends EventType> {
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

export type QueueJob<T extends EventType = EventType> = BaseJob<T>;

export type JobHandlerPayload<
  T extends EventType = EventType,
  ReturnType = unknown,
> = Job<QueueJob<T>, ReturnType>;

export type JobHandlerType<
  T extends EventType = EventType,
  ReturnType = unknown,
> = (job: JobHandlerPayload<T, ReturnType>) => Promise<ReturnType>;
