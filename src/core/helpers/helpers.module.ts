import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { HelpersService } from './services/helpers.service';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [HelpersService],
  exports: [HelpersService],
})
export class HelpersModule {}
