import { Injectable } from '@nestjs/common';
import { AIModelItemDto } from '../dto/ai-model-item.dto';
import { AIResponseDto } from '../dto/ai-response.dto';
import { AIProvider } from '../enum/ai-provider.enum';
import { AIProviderService } from './ai-provider.service';

@Injectable()
export class AIService {
  constructor(private aiProviderService: AIProviderService) {}

  async queryProvider(
    provider: AIProvider,
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): Promise<AIResponseDto> {
    const responseText = await this.aiProviderService.queryProvider(
      provider,
      model,
      prompt,
      systemPrompt,
    );

    return {
      model,
      provider,
      text: responseText,
    };
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
