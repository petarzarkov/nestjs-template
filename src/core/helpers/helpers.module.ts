import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { FetchService } from './services/fetch.service';
import { HelpersService } from './services/helpers.service';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [HelpersService, FetchService],
  exports: [HelpersService, FetchService],
})
export class HelpersModule {}
