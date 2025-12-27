import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for storing the event type on the handler method.
 */
export const STREAM_EVENT_METADATA = 'stream:event:pattern';

/**
 * Decorator for marking methods as Redis Stream event handlers.
 * Works similarly to `@EventPattern` but for Redis Streams instead of pub/sub.
 *
 * @example
 * Decorate a method with the event type you want to handle.
 * ```ts
 * @StreamEvent('user.registered')
 * async handleEvent(@Payload() event: BaseEvent<'user.registered'>) {
 * // Handle the event
 * }
 * ```
 */
export const StreamEvent = (eventType: string) =>
  SetMetadata(STREAM_EVENT_METADATA, eventType);
