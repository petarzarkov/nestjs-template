import { Module } from '@nestjs/common';
import { EmailModule } from './email/email.module';
import { EventsModule } from './events/events.module';
import { NotificationQueue } from './queues/notification.queue';
import { NotificationPublisherService } from './services/notification-publisher.service';
import { NotificationWorker } from './workers/notification.worker';

/**
 * Module for BullMQ-based notification queues.
 * Provides queue, worker, and publisher services.
 */
@Module({
  imports: [EmailModule, EventsModule.forRoot()],
  providers: [
    NotificationQueue,
    NotificationWorker,
    NotificationPublisherService,
  ],
  exports: [NotificationPublisherService],
})
export class NotificationQueueModule {}
