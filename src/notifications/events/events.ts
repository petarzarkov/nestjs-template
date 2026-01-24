import type {
  InvitePayload,
  PasswordResetPayload,
  RegisteredPayload,
} from '@/notifications/dto/user-notifications.dto';

export const EVENTS = {
  EXCHANGE: 'domain_events_exchange',
  QUEUES: {
    NOTIFICATIONS_EVENTS: 'notifications-events-queue',
    BACKGROUND_JOBS: 'background-jobs-queue',
  },
  ROUTING_KEYS: {
    // User domain events
    USER_REGISTERED: 'user.registered',
    USER_INVITED: 'user.invited',
    USER_PASSWORD_RESET: 'user.password_reset',
  },
} as const;

export interface EventMap {
  [EVENTS.ROUTING_KEYS.USER_REGISTERED]: RegisteredPayload;
  [EVENTS.ROUTING_KEYS.USER_INVITED]: InvitePayload;
  [EVENTS.ROUTING_KEYS.USER_PASSWORD_RESET]: PasswordResetPayload;
}

export type EventType = keyof EventMap;

export type QueueType = (typeof EVENTS.QUEUES)[keyof typeof EVENTS.QUEUES];

export type RoutingKeyType =
  (typeof EVENTS.ROUTING_KEYS)[keyof typeof EVENTS.ROUTING_KEYS];
