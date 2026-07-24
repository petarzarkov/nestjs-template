import { ContextLogger } from '@arkv/nestjs-context-logger';
import { Injectable } from '@nestjs/common';
import { AIProvider } from '@/ai/enum/ai-provider.enum';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { FetchService } from '@/core/helpers/services/fetch.service';
import { OpenAICompatibleAiService } from './openai-compatible-ai.service';

/**
 * Groq over its OpenAI-compatible API — fast, free-tier-friendly, with a quota
 * pool separate from Gemini.
 */
@Injectable()
export class GroqAIService extends OpenAICompatibleAiService {
  constructor(
    configService: AppConfigService<ValidatedConfig>,
    fetchService: FetchService,
    logger: ContextLogger,
  ) {
    const ai = configService.get('ai');
    const groq = ai.providers[AIProvider.GROQ];
    super(fetchService, logger, {
      baseUrl: groq?.url ?? '',
      apiKey: groq?.apiKey ?? '',
      temperature: ai.defaults.temperature,
      streamTimeout: ai.streamTimeout,
      label: 'Groq',
      defaultModel: 'llama-3.3-70b-versatile',
      staticModels: [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'openai/gpt-oss-20b',
      ],
    });
  }
}
