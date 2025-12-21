import { Global, Module } from '@nestjs/common';
import { ContextLogger } from './services/context-logger.service';
import { ContextService } from './services/context.service';

@Global()
@Module({
  providers: [ContextService, ContextLogger],
  exports: [ContextService, ContextLogger],
})
export class LoggerModule {}
