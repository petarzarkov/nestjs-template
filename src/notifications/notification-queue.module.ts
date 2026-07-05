import { Module } from '@nestjs/common';
import { EmailModule } from './email/email.module';
import { EventsModule } from './events/events.module';
import { NotificationHandler } from './handlers/notification.handler';

// JobPublisherService is provided globally by the @Global QueueModule.
@Module({
  imports: [EmailModule, EventsModule.forRoot()],
  providers: [NotificationHandler],
})
export class NotificationQueueModule {}
