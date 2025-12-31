import { DynamicModule, Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './services/ai.service';
import { AIProviderService } from './services/ai-provider.service';

@Module({})
export class AIModule {
  static forRoot(): DynamicModule {
    return {
      module: AIModule,
      global: true,
      providers: [AIService, AIProviderService],
      exports: [AIService, AIProviderService],
      controllers: [AIController],
    };
  }
}
