import { Job } from 'bullmq';
import type { BaseEvent } from '@/notifications/events/base-event.dto';
import type { EventType } from '@/notifications/events/events';

export type QueueJob<T extends EventType = EventType> = BaseEvent<T>;

export type JobHandlerPayload<
  T extends EventType = EventType,
  ReturnType = unknown,
> = Job<QueueJob<T>, ReturnType>;

export type JobHandlerType<
  T extends EventType = EventType,
  ReturnType = unknown,
> = (job: JobHandlerPayload<T, ReturnType>) => Promise<ReturnType>;
