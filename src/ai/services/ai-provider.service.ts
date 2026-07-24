import { ContextLogger } from '@arkv/nestjs-context-logger';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AIProvider } from '../enum/ai-provider.enum';
import type { BaseProviderAiService } from './base-provider-ai.service';
import { GoogleAIService } from './google-ai.service';
import { GroqAIService } from './groq-ai.service';
import { OpenRouterAIService } from './openrouter-ai.service';

/**
 * Routes an {@link AIProvider} to its dedicated service. Every provider
 * implements the same {@link BaseProviderAiService} contract (Google via
 * `@google/genai`, the OpenAI-compatible ones via `FetchService`/raw SSE), so
 * dispatch is uniform — there is no shared third-party AI SDK, just a lookup.
 */
@Injectable()
export class AIProviderService {
  private readonly services: Record<AIProvider, BaseProviderAiService>;

  constructor(
    googleAI: GoogleAIService,
    groqAI: GroqAIService,
    openRouterAI: OpenRouterAIService,
    private readonly logger: ContextLogger,
  ) {
    this.services = {
      [AIProvider.GOOGLE]: googleAI,
      [AIProvider.GROQ]: groqAI,
      [AIProvider.OPENROUTER]: openRouterAI,
    };
  }

  private service(provider: AIProvider): BaseProviderAiService {
    const service = this.services[provider];
    if (!service?.configured) {
      throw new InternalServerErrorException(
        `${provider} provider not configured`,
      );
    }
    return service;
  }

  async queryProvider(
    provider: AIProvider,
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): Promise<string> {
    try {
      return await this.service(provider).generateText(
        model,
        prompt,
        systemPrompt,
      );
    } catch (error) {
      this.logError('Query', provider, model, error);
      throw error;
    }
  }

  async queryStructured<TSchema extends ZodType>(
    provider: AIProvider,
    model: string,
    prompt: string,
    schema: TSchema,
    systemPrompt?: string,
  ): Promise<TSchema['_output']> {
    try {
      return await this.service(provider).generateStructured(
        model,
        prompt,
        schema,
        systemPrompt,
      );
    } catch (error) {
      this.logError('Structured query', provider, model, error);
      throw error;
    }
  }

  async *streamProvider(
    provider: AIProvider,
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): AsyncGenerator<string> {
    yield* this.service(provider).streamText(model, prompt, systemPrompt);
  }

  async listModels(provider: AIProvider): Promise<string[]> {
    const service = this.services[provider];
    if (!service?.configured) {
      return [];
    }
    try {
      return await service.listModels();
    } catch (error) {
      this.logError('List models', provider, undefined, error);
      return [];
    }
  }

  private logError(
    op: string,
    provider: AIProvider,
    model: string | undefined,
    error: unknown,
  ): void {
    this.logger.error(`${op} error from ${provider} provider`, {
      err: error,
      provider,
      model,
    });
  }
}
