import { Module } from '@nestjs/common';
import { JobPublisherService } from '../infra/queue/services/job-publisher.service';
import { EmailModule } from './email/email.module';
import { EventsModule } from './events/events.module';
import { NotificationHandler } from './handlers/notification.handler';

@Module({
  imports: [EmailModule, EventsModule.forRoot()],
  providers: [NotificationHandler, JobPublisherService],
  exports: [JobPublisherService],
})
export class NotificationQueueModule {}
