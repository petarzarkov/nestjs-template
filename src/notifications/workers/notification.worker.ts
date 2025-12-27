import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { type Job, Worker } from 'bullmq';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextService } from '@/logger/services/context.service';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { EmailService } from '../email/services/email.service';
import type { EventType } from '../events/events';
import { EVENT_CONSTANTS } from '../events/events';
import { EventsGateway } from '../events/events.gateway';
import type { NotificationJob } from '../queues/notification.queue';

type JobHandler<T extends EventType = EventType> = (
  job: Job<NotificationJob<T>>,
) => Promise<void>;

/**
 * BullMQ worker for processing notification jobs.
 * Uses a handler mapper pattern instead of switch statements.
 */
@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<NotificationJob>;
  private readonly eventHandlers: Record<string, JobHandler>;

  constructor(
    private readonly configService: AppConfigService<ValidatedConfig>,
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
    private readonly emailService: EmailService,
    private readonly eventsGateway: EventsGateway,
  ) {
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

  async onModuleInit() {
    const redisConfig = this.configService.get('redis');
    if (!redisConfig?.queues.enabled) {
      this.logger.log('Redis queues not enabled, NotificationWorker disabled');
      return;
    }

    this.worker = new Worker<NotificationJob>(
      'notifications',
      async (job: Job<NotificationJob>) => {
        return this.contextService.runWithContext(
          {
            flow: 'queue',
            context: 'NotificationWorker',
            event: job.data.eventType,
            requestId: job.data.metadata?.requestId,
            userId: job.data.metadata?.userId,
          },
          async () => {
            await this.processJob(job);
          },
        );
      },
      {
        connection: {
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          db: redisConfig.db,
        },
        concurrency: redisConfig.queues.concurrency,
        limiter: redisConfig.queues.rateLimitMax
          ? {
              max: redisConfig.queues.rateLimitMax,
              duration: redisConfig.queues.rateLimitDuration,
            }
          : undefined,
      },
    );

    // Event listeners
    this.worker.on('completed', job => {
      this.logger.verbose(
        `Job completed: ${job.id} for event type: ${job.data.eventType}`,
        {
          eventType: job.data.eventType,
          duration:
            job.finishedOn && job.processedOn
              ? job.finishedOn - job.processedOn
              : 0,
        },
      );
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        job
          ? `Job failed: ${job.id} for event type: ${job.data.eventType}`
          : 'Job failed',
        {
          eventType: job?.data.eventType,
          error: err,
          attempt: job?.attemptsMade,
          maxAttempts: job?.opts.attempts,
        },
      );
    });

    this.worker.on('error', err => {
      this.logger.error('Worker error', { error: err });
    });

    this.logger.log('Notification worker started', {
      concurrency: redisConfig.queues.concurrency,
      handlers: Object.keys(this.eventHandlers).length,
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('Notification worker stopped');
    }
  }

  /**
   * Process a job by routing to the appropriate handler
   */
  private async processJob(job: Job<NotificationJob>) {
    const { eventType } = job.data;

    const handler = this.eventHandlers[eventType];

    if (!handler) {
      this.logger.warn(`No handler found for event type: ${eventType}`);
      throw new Error(`No handler registered for event: ${eventType}`);
    }

    await handler(job);
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
}
