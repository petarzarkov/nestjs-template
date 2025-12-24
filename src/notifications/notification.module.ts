import { forwardRef, Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
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
