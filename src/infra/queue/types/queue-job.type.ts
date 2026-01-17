import type { BaseEvent } from '@/notifications/events/base-event.dto';
import type { EventType } from '@/notifications/events/events';

export type QueueJob<T extends EventType = EventType> = BaseEvent<T>;
