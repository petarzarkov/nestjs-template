import { Injectable } from '@nestjs/common';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import { JobHandler } from '@/infra/queue/decorators/job-handler.decorator';
import { type JobHandlerPayload } from '@/infra/queue/types/queue-job.type';
import { EmailService } from '../email/services/email.service';
import { EVENT_CONSTANTS } from '../events/events';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class NotificationHandler {
  constructor(
    private readonly logger: ContextLogger,
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

    this.logger.verbose(`Job completed - ID: ${job.id}; EVENT: ${eventType}`);
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

    this.logger.verbose(`Job completed - ID: ${job.id}; EVENT: ${eventType}`);
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
    const { payload, eventType } = job.data;

    await this.emailService.sendPasswordResetEmail(payload);

    // no WS event, or?

    this.logger.verbose(`Job completed - ID: ${job.id}; EVENT: ${eventType}`);
  }
}
