import { Injectable } from '@nestjs/common';
import { JobHandler } from '@/infra/queue/decorators/job-handler.decorator';
import { type JobHandlerPayload } from '@/infra/queue/types/queue-job.type';
import { EmailService } from '../email/services/email.service';
import { EVENTS } from '../events/events';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class NotificationHandler {
  constructor(
    private readonly emailService: EmailService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  @JobHandler({
    queue: EVENTS.QUEUES.BACKGROUND_JOBS,
    name: EVENTS.ROUTING_KEYS.USER_REGISTERED,
  })
  async handleUserRegistered(
    job: JobHandlerPayload<typeof EVENTS.ROUTING_KEYS.USER_REGISTERED>,
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
    queue: EVENTS.QUEUES.NOTIFICATIONS_EVENTS,
    name: EVENTS.ROUTING_KEYS.USER_INVITED,
  })
  async handleUserInvited(
    job: JobHandlerPayload<typeof EVENTS.ROUTING_KEYS.USER_INVITED>,
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
    queue: EVENTS.QUEUES.NOTIFICATIONS_EVENTS,
    name: EVENTS.ROUTING_KEYS.USER_PASSWORD_RESET,
  })
  async handlePasswordReset(
    job: JobHandlerPayload<typeof EVENTS.ROUTING_KEYS.USER_PASSWORD_RESET>,
  ): Promise<void> {
    const { payload } = job.data;

    await this.emailService.sendPasswordResetEmail(payload);

    // no WS event, or?
  }
}
