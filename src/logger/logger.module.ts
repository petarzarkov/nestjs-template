import { Global, Module } from '@nestjs/common';
import { ContextService } from './services/context.service';
import { ContextLogger } from './services/context-logger.service';

@Global()
@Module({
  providers: [ContextService, ContextLogger],
  exports: [ContextService, ContextLogger],
})
export class LoggerModule {}
