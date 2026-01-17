import { Injectable } from '@nestjs/common';
import { JobHandler } from '@/infra/queue/decorators/job-handler.decorator';
import { type JobHandlerPayload } from '@/infra/queue/types/queue-job.type';
import { EmailService } from '../email/services/email.service';
import { EVENT_CONSTANTS } from '../events/events';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class NotificationHandler {
  constructor(
    private readonly emailService: EmailService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  @JobHandler({
    queue: EVENT_CONSTANTS.QUEUES.BACKGROUND_JOBS,
    name: EVENT_CONSTANTS.ROUTING_KEYS.USER_REGISTERED,
  })
  async handleUserRegistered(
    job: JobHandlerPayload<typeof EVENT_CONSTANTS.ROUTING_KEYS.USER_REGISTERED>,
  ): Promise<void> {
    const { payload, metadata, eventType } = job.data ?? {};
    await this.emailService.sendWelcomeEmail(payload);

    this.eventsGateway.sendNotification({
      emitToAdmins: metadata?.emitToAdmins ?? true,
      userId: metadata?.userId,
      eventType,
      payload,
    });
  }

  @JobHandler({
    queue: EVENT_CONSTANTS.QUEUES.NOTIFICATIONS_EVENTS,
    name: EVENT_CONSTANTS.ROUTING_KEYS.USER_INVITED,
  })
  async handleUserInvited(
    job: JobHandlerPayload<typeof EVENT_CONSTANTS.ROUTING_KEYS.USER_INVITED>,
  ): Promise<void> {
    const { payload, metadata, eventType } = job.data ?? {};

    await this.emailService.sendInviteEmail(payload);

    this.eventsGateway.sendNotification({
      emitToAdmins: metadata?.emitToAdmins ?? true,
      eventType,
      payload,
    });
  }

  @JobHandler({
    queue: EVENT_CONSTANTS.QUEUES.NOTIFICATIONS_EVENTS,
    name: EVENT_CONSTANTS.ROUTING_KEYS.USER_PASSWORD_RESET,
  })
  async handlePasswordReset(
    job: JobHandlerPayload<
      typeof EVENT_CONSTANTS.ROUTING_KEYS.USER_PASSWORD_RESET
    >,
  ): Promise<void> {
    const { payload } = job.data;

    await this.emailService.sendPasswordResetEmail(payload);

    // no WS event, or?
  }
}
