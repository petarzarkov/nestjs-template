import { DynamicModule, Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIProviderService } from './services/ai-provider.service';
import { AIService } from './services/ai.service';
import { GoogleAIService } from './services/google-ai.service';
import { GroqAIService } from './services/groq-ai.service';
import { OpenRouterAIService } from './services/openrouter-ai.service';

@Module({})
export class AIModule {
  static forRoot(): DynamicModule {
    const providers = [
      GoogleAIService,
      GroqAIService,
      OpenRouterAIService,
      AIProviderService,
      AIService,
    ];
    return {
      module: AIModule,
      global: true,
      providers,
      exports: providers,
      controllers: [AIController],
    };
  }
}
