import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { QueueDashboardController } from './queue-dashboard.controller';
import { JobDispatcherService } from './services/job-dispatcher.service';
import { JobPublisherService } from './services/job-publisher.service';

@Global()
@Module({
  imports: [DiscoveryModule],
  controllers: [QueueDashboardController],
  providers: [JobDispatcherService, JobPublisherService],
  exports: [JobDispatcherService, JobPublisherService],
})
export class QueueModule {}
