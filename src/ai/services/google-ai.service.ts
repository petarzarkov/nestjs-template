import { ContextLogger } from '@arkv/nestjs-context-logger';
import { Injectable } from '@nestjs/common';
import { AIProvider } from '@/ai/enum/ai-provider.enum';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { FetchService } from '@/core/helpers/services/fetch.service';
import { OpenAICompatibleAiService } from './openai-compatible-ai.service';

/**
 * Google Gemini through its **OpenAI-compatible** endpoint (`/v1beta/openai`) —
 * the exact same REST + SSE path as Groq/OpenRouter, so no `@google/genai` SDK
 * is needed. Chat, streaming and structured output all go through
 * {@link OpenAICompatibleAiService}. See
 * https://ai.google.dev/gemini-api/docs/openai
 */
@Injectable()
export class GoogleAIService extends OpenAICompatibleAiService {
  constructor(
    configService: AppConfigService<ValidatedConfig>,
    fetchService: FetchService,
    logger: ContextLogger,
  ) {
    const ai = configService.get('ai');
    const google = ai.providers[AIProvider.GOOGLE];
    super(fetchService, logger, {
      baseUrl: google?.url ?? '',
      apiKey: google?.apiKey ?? '',
      temperature: ai.defaults.temperature,
      streamTimeout: ai.streamTimeout,
      label: 'Google',
      defaultModel: 'gemini-2.5-flash',
      staticModels: [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.5-flash-lite',
      ],
    });
  }

  /** Gemini's OpenAI `/models` returns ids as `models/<id>` — strip the prefix. */
  override async listModels(): Promise<string[]> {
    const ids = await super.listModels();
    return ids.map(id => id.replace(/^models\//, ''));
  }
}
