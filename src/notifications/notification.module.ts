import { Global, Module } from '@nestjs/common';
import { NotificationQueueModule } from './notification-queue.module';

@Global()
@Module({
  imports: [NotificationQueueModule],
  exports: [NotificationQueueModule],
})
export class NotificationModule {}
