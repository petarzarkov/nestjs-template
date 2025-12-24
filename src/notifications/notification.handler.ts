import { ContextLogger } from '@/logger/services/context-logger.service';
import type { BaseEvent } from '@/redis/pubsub/base-event.dto';
import { EventLoggingInterceptor } from '@/redis/pubsub/event-logging.interceptor';
import { Controller, Injectable, UseInterceptors } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EmailService } from './email/services/email.service';
import { EVENT_CONSTANTS } from './events/events';
import { EventsGateway } from './events/events.gateway';

@Controller()
@UseInterceptors(EventLoggingInterceptor)
@Injectable()
export class NotificationHandler {
  constructor(
    private readonly emailService: EmailService,
    private readonly eventsGateway: EventsGateway,
    private readonly logger: ContextLogger,
  ) {}

  @EventPattern(EVENT_CONSTANTS.ROUTING_KEYS.USER_REGISTERED)
  async handleUserRegistered(
    @Payload()
    event: BaseEvent<typeof EVENT_CONSTANTS.ROUTING_KEYS.USER_REGISTERED>,
  ) {
    await this.emailService.sendWelcomeEmail(event.payload);
    this.eventsGateway.sendNotification({
      emitToAdmins: event.metadata?.emitToAdmins ?? true,
      userId: event.metadata?.userId,
      eventType: EVENT_CONSTANTS.ROUTING_KEYS.USER_REGISTERED,
      payload: event.payload,
    });
  }

  @EventPattern(EVENT_CONSTANTS.ROUTING_KEYS.USER_INVITED)
  async handleUserInvited(
    @Payload()
    event: BaseEvent<typeof EVENT_CONSTANTS.ROUTING_KEYS.USER_INVITED>,
  ) {
    await this.emailService.sendInviteEmail(event.payload);
    this.eventsGateway.sendNotification({
      emitToAdmins: event.metadata?.emitToAdmins ?? true,
      eventType: EVENT_CONSTANTS.ROUTING_KEYS.USER_INVITED,
      payload: event.payload,
    });
  }

  @EventPattern(EVENT_CONSTANTS.ROUTING_KEYS.USER_PASSWORD_RESET)
  async handlePasswordReset(
    @Payload()
    event: BaseEvent<typeof EVENT_CONSTANTS.ROUTING_KEYS.USER_PASSWORD_RESET>,
  ) {
    await this.emailService.sendPasswordResetEmail(event.payload);
    // No WS notification for password reset (security)
  }
}
