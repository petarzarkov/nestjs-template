import { Injectable } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AIModelItemDto } from '../dto/ai-model-item.dto';
import { AIResponseDto } from '../dto/ai-response.dto';
import { AIProvider } from '../enum/ai-provider.enum';
import { AIProviderService } from './ai-provider.service';

@Injectable()
export class AIService {
  constructor(private readonly aiProviderService: AIProviderService) {}

  async queryProvider(
    provider: AIProvider,
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): Promise<AIResponseDto> {
    const text = await this.aiProviderService.queryProvider(
      provider,
      model,
      prompt,
      systemPrompt,
    );

    return { model, provider, text };
  }

  /** Zod-validated structured output from the model. */
  queryStructured<TSchema extends ZodType>(
    provider: AIProvider,
    model: string,
    prompt: string,
    schema: TSchema,
    systemPrompt?: string,
  ): Promise<TSchema['_output']> {
    return this.aiProviderService.queryStructured(
      provider,
      model,
      prompt,
      schema,
      systemPrompt,
    );
  }

  async *streamProvider(
    provider: AIProvider,
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): AsyncGenerator<string> {
    yield* this.aiProviderService.streamProvider(
      provider,
      model,
      prompt,
      systemPrompt,
    );
  }

  async listAllModels(): Promise<AIModelItemDto[]> {
    const providers = Object.values(AIProvider);
    const results = await Promise.all(
      providers.map(async provider => ({
        provider,
        models: await this.aiProviderService.listModels(provider),
      })),
    );

    return results.filter(result => result.models.length > 0);
  }
}
