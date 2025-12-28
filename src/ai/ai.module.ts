import { GoogleGenAI } from '@google/genai';
import { DynamicModule, Provider } from '@nestjs/common';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { GeminiAIProvider } from './providers/gemini-ai.provider';
import { GenericAIProvider } from './providers/generic-ai.provider';

export class AIModule {
  static forRoot(): DynamicModule {
    const providers: Provider[] = [AIService];

    const exports: (string | symbol | Provider)[] = [AIService];

    if (process.env.AI_GEMINI_API_KEY) {
      providers.push({
        provide: GoogleGenAI,
        useFactory: (configService: AppConfigService<ValidatedConfig>) => {
          const config = configService.getOrThrow('ai.providers');
          if (!config.google) {
            throw new Error('Google API config not found');
          }

          return new GoogleGenAI({ apiKey: config.google.apiKey });
        },
        inject: [AppConfigService],
      });
      providers.push(GeminiAIProvider);
      exports.push(GeminiAIProvider);
    }

    if (process.env.AI_GROQ_API_KEY || process.env.AI_OPENROUTER_API_KEY) {
      providers.push(GenericAIProvider);
      exports.push(GenericAIProvider);
    }

    return {
      module: AIModule,
      providers,
      exports,
      controllers: [AIController],
    };
  }
}
