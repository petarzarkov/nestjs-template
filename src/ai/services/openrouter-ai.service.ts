import { ContextLogger } from '@arkv/nestjs-context-logger';
import { Injectable } from '@nestjs/common';
import { AIProvider } from '@/ai/enum/ai-provider.enum';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { FetchService } from '@/core/helpers/services/fetch.service';
import { OpenAICompatibleAiService } from './openai-compatible-ai.service';

/**
 * OpenRouter over its OpenAI-compatible API — one key that fans out to many
 * models (Claude, GPT, open models), covering "I want provider X" without a
 * direct dependency on each vendor's SDK.
 */
@Injectable()
export class OpenRouterAIService extends OpenAICompatibleAiService {
  constructor(
    configService: AppConfigService<ValidatedConfig>,
    fetchService: FetchService,
    logger: ContextLogger,
  ) {
    const ai = configService.get('ai');
    const openrouter = ai.providers[AIProvider.OPENROUTER];
    super(fetchService, logger, {
      baseUrl: openrouter?.url ?? '',
      apiKey: openrouter?.apiKey ?? '',
      temperature: ai.defaults.temperature,
      streamTimeout: ai.streamTimeout,
      label: 'OpenRouter',
      defaultModel: 'meta-llama/llama-3.1-70b-instruct',
      staticModels: [
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
        'meta-llama/llama-3.1-70b-instruct',
      ],
    });
  }
}
