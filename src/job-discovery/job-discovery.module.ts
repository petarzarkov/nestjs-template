import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { JobDiscoveryService } from './job-discovery.service';

@Module({
  imports: [DiscoveryModule],
  providers: [JobDiscoveryService],
})
export class JobDiscoveryModule {}
