import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { EmailModule } from './email/email.module';
import { EVENT_CONSTANTS } from './events/events';
import { EventsModule } from './events/events.module';
import { NotificationHandlersService } from './services/notification-handlers.service';
import { NotificationPublisherService } from './services/notification-publisher.service';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: EVENT_CONSTANTS.QUEUES.NOTIFICATIONS_EVENTS,
      useFactory: (configService: AppConfigService<ValidatedConfig>) => {
        const redisConfig = configService.get('redis');
        return {
          defaultJobOptions: {
            attempts: redisConfig.queues.maxRetries,
            backoff: {
              type: 'exponential',
              delay: redisConfig.queues.retryDelayMs,
            },
            removeOnComplete: {
              count: 100, // Keep last 100 completed jobs
              age: 86400, // 24 hours
            },
            removeOnFail: {
              count: 500, // Keep last 500 failed jobs
              age: 604800, // 7 days
            },
          },
        };
      },
      inject: [AppConfigService],
    }),
    EmailModule,
    EventsModule.forRoot(),
  ],
  providers: [NotificationHandlersService, NotificationPublisherService],
  exports: [NotificationPublisherService],
})
export class NotificationQueueModule {}
