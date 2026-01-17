import { Global, Module } from '@nestjs/common';
import { HelpersModule } from '@/core/helpers/helpers.module';
import { ContextService } from './services/context.service';
import { ContextLogger } from './services/context-logger.service';

@Global()
@Module({
  imports: [HelpersModule],
  providers: [ContextService, ContextLogger],
  exports: [ContextService, ContextLogger],
})
export class LoggerModule {}
