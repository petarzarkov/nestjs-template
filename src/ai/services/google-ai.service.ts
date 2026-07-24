import { ContextLogger } from '@arkv/nestjs-context-logger';
import { GoogleGenAI } from '@google/genai';
import { Injectable } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AIProvider } from '@/ai/enum/ai-provider.enum';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { FetchService } from '@/core/helpers/services/fetch.service';
import { HelpersService } from '@/core/helpers/services/helpers.service';
import { BaseProviderAiService } from './base-provider-ai.service';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const STATIC_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
];
const MAX_OUTPUT_TOKENS = 4096;

interface GeminiModelListResponse {
  models?: { name: string; supportedGenerationMethods?: string[] }[];
}

/**
 * Google Gemini via the official `@google/genai` SDK (the only AI SDK in the
 * stack). Non-streaming calls are wrapped in {@link HelpersService.executeWithRetry}
 * for transient 5xx/timeout resilience; streaming uses `generateContentStream`.
 */
@Injectable()
export class GoogleAIService extends BaseProviderAiService {
  private readonly genAi: GoogleGenAI;
  private readonly apiKey: string;
  private readonly modelsUrl: string;
  private readonly temperature: number;

  constructor(
    configService: AppConfigService<ValidatedConfig>,
    private readonly helpers: HelpersService,
    private readonly fetchService: FetchService,
    logger: ContextLogger,
  ) {
    super(logger);
    const ai = configService.get('ai');
    const google = ai.providers[AIProvider.GOOGLE];
    this.apiKey = google?.apiKey ?? '';
    this.modelsUrl = google?.url ?? '';
    this.temperature = ai.defaults.temperature;
    this.genAi = new GoogleGenAI({ apiKey: this.apiKey });
  }

  get configured(): boolean {
    return Boolean(this.apiKey);
  }

  async generateText(
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): Promise<string> {
    return this.helpers.executeWithRetry(async () => {
      const result = await this.genAi.models.generateContent({
        model: model || DEFAULT_MODEL,
        contents: this.contents(prompt, systemPrompt),
        config: {
          temperature: this.temperature,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      });
      return result.text ?? '';
    });
  }

  async generateStructured<T>(
    model: string,
    prompt: string,
    schema: ZodType<T>,
    systemPrompt?: string,
  ): Promise<T> {
    const raw = await this.helpers.executeWithRetry(async () => {
      const result = await this.genAi.models.generateContent({
        model: model || DEFAULT_MODEL,
        contents: this.contents(prompt, systemPrompt),
        config: {
          temperature: this.temperature,
          // Constrained decoding forces the exact field shape — without it
          // Gemini infers the shape from prose and can omit fields.
          responseMimeType: 'application/json',
          responseJsonSchema: this.jsonSchema(schema),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      });
      return result.text ?? '{}';
    });

    return this.parseJson(raw, schema);
  }

  async *streamText(
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): AsyncGenerator<string> {
    const stream = await this.genAi.models.generateContentStream({
      model: model || DEFAULT_MODEL,
      contents: this.contents(prompt, systemPrompt),
      config: {
        temperature: this.temperature,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }

  async listModels(): Promise<string[]> {
    if (!this.apiKey) {
      return [];
    }
    try {
      // Auth via header (not `?key=`) so the key never lands in a logged URL.
      const data = await this.fetchService.get<GeminiModelListResponse>(
        this.modelsUrl,
        { headers: { 'x-goog-api-key': this.apiKey }, flow: 'Google:models' },
      );
      const ids =
        data.models
          ?.filter(m =>
            m.supportedGenerationMethods?.includes('generateContent'),
          )
          .map(m => m.name.replace('models/', '')) ?? [];
      return ids.length ? ids : STATIC_MODELS;
    } catch {
      return STATIC_MODELS;
    }
  }

  private contents(prompt: string, systemPrompt?: string) {
    const text = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    return [{ role: 'user', parts: [{ text }] }];
  }
}
