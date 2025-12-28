import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ContextService } from '@/logger/services/context.service';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { EmailService } from '../email/services/email.service';
import type { EventType } from '../events/events';
import { EVENT_CONSTANTS } from '../events/events';
import { EventsGateway } from '../events/events.gateway';
import type { NotificationJob } from '../types/notification-job';

type JobHandler<T extends EventType = EventType> = (
  job: Job<NotificationJob<T>>,
) => Promise<void>;

@Injectable()
@Processor(EVENT_CONSTANTS.QUEUES.NOTIFICATIONS_EVENTS)
export class NotificationProcessor extends WorkerHost {
  private readonly eventHandlers: Record<string, JobHandler>;

  constructor(
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
    private readonly emailService: EmailService,
    private readonly eventsGateway: EventsGateway,
  ) {
    super();

    // Initialize handler map with bound methods
    this.eventHandlers = {
      [EVENT_CONSTANTS.ROUTING_KEYS.USER_REGISTERED]:
        this.handleUserRegistered.bind(this) as JobHandler,
      [EVENT_CONSTANTS.ROUTING_KEYS.USER_INVITED]: this.handleUserInvited.bind(
        this,
      ) as JobHandler,
      [EVENT_CONSTANTS.ROUTING_KEYS.USER_PASSWORD_RESET]:
        this.handlePasswordReset.bind(this) as JobHandler,
    };
  }

  async process(job: Job<NotificationJob>): Promise<void> {
    return this.contextService.runWithContext(
      {
        flow: 'queue',
        context: 'NotificationProcessor',
        event: job.data.eventType,
        ...this.contextService.getContext(),
        ...(job.data.metadata?.requestId && {
          requestId: job.data.metadata?.requestId,
        }),
        ...(job.data.metadata?.userId && { userId: job.data.metadata?.userId }),
      },
      async () => {
        const { eventType } = job.data;

        const handler = this.eventHandlers[eventType];

        if (!handler) {
          this.logger.warn(`No handler found for event type: ${eventType}`);
          throw new Error(`No handler registered for event: ${eventType}`);
        }

        await handler(job);
      },
    );
  }

  private async handleUserRegistered(
    job: Job<
      NotificationJob<typeof EVENT_CONSTANTS.ROUTING_KEYS.USER_REGISTERED>
    >,
  ): Promise<void> {
    const { payload, metadata } = job.data;

    await this.emailService.sendWelcomeEmail(payload);

    this.eventsGateway.sendNotification({
      emitToAdmins: metadata?.emitToAdmins ?? true,
      userId: metadata?.userId,
      eventType: EVENT_CONSTANTS.ROUTING_KEYS.USER_REGISTERED,
      payload,
    });
  }

  private async handleUserInvited(
    job: Job<NotificationJob<typeof EVENT_CONSTANTS.ROUTING_KEYS.USER_INVITED>>,
  ): Promise<void> {
    const { payload, metadata } = job.data;

    await this.emailService.sendInviteEmail(payload);

    this.eventsGateway.sendNotification({
      emitToAdmins: metadata?.emitToAdmins ?? true,
      eventType: EVENT_CONSTANTS.ROUTING_KEYS.USER_INVITED,
      payload,
    });
  }

  private async handlePasswordReset(
    job: Job<
      NotificationJob<typeof EVENT_CONSTANTS.ROUTING_KEYS.USER_PASSWORD_RESET>
    >,
  ): Promise<void> {
    const { payload } = job.data;

    await this.emailService.sendPasswordResetEmail(payload);
    // No WS notification for password reset (security)
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.verbose(
      `Processing job ${job.id} for event type: ${job.data.eventType}`,
      {
        eventType: job.data.eventType,
        attempt: job.attemptsMade,
        priority: job.opts.priority,
        requestId: job.data.metadata?.requestId,
        userId: job.data.metadata?.userId,
      },
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.verbose(
      `Job completed: ${job.id} for event type: ${job.data.eventType}`,
      {
        eventType: job.data.eventType,
        duration:
          job.finishedOn && job.processedOn
            ? job.finishedOn - job.processedOn
            : 0,
        requestId: job.data.metadata?.requestId,
        userId: job.data.metadata?.userId,
      },
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(
      job
        ? `Job failed: ${job.id} for event type: ${job.data.eventType}`
        : 'Job failed',
      {
        eventType: job?.data.eventType,
        error,
        attempt: job?.attemptsMade,
        maxAttempts: job?.opts.attempts,
        requestId: job?.data.metadata?.requestId,
        userId: job?.data.metadata?.userId,
      },
    );
  }

  @OnWorkerEvent('error')
  onError(error: Error) {
    this.logger.error('Worker error', { error });
  }
}
