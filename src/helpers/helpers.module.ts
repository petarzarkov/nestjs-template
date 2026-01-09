import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { HelpersService } from './services/helpers.service';
import { JobDispatcherService } from './services/job-dispatcher.service';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [HelpersService, JobDispatcherService],
  exports: [HelpersService, JobDispatcherService],
})
export class HelpersModule {}
