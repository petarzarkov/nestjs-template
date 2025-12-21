import { Global, Module } from '@nestjs/common';
import { HelpersService } from './services/helpers.service';

@Global()
@Module({
  providers: [HelpersService],
  exports: [HelpersService],
})
export class HelpersModule {}
