import { UsersModule } from '@/users/users.module';
import { Module, forwardRef } from '@nestjs/common';
import { EmailModule } from './email/email.module';
import { EventsModule } from './events/events.module';
import { NotificationHandler } from './notification.handler';

@Module({
  imports: [EmailModule, EventsModule.forRoot(), forwardRef(() => UsersModule)],
  controllers: [NotificationHandler],
  providers: [NotificationHandler],
  exports: [NotificationHandler],
})
export class NotificationModule {}
