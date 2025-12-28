import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { AIResponseDto } from './dto/ai-response.dto';
import { AIProvider } from './enum/ai-provider.enum';
import { GeminiAIProvider } from './providers/gemini-ai.provider';
import { GenericAIProvider } from './providers/generic-ai.provider';

@Injectable()
export class AIService {
  #config: ValidatedConfig['ai'];

  constructor(
    private configService: AppConfigService<ValidatedConfig>,
    private geminiAIProvider: GeminiAIProvider,
    private genericAIProvider: GenericAIProvider,
  ) {
    this.#config = this.configService.getOrThrow('ai');
  }

  async queryProvider(
    provider: AIProvider,
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): Promise<AIResponseDto> {
    const providerConfig = this.#config.providers[provider];
    if (!providerConfig) {
      throw new InternalServerErrorException(
        `AI provider ${provider} not configured`,
      );
    }

    const responseText =
      provider === AIProvider.GOOGLE
        ? await this.geminiAIProvider.queryProvider(model, prompt, systemPrompt)
        : await this.genericAIProvider.queryProvider(
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

  async listModels(provider: AIProvider): Promise<string[]> {
    if (provider === AIProvider.GOOGLE) {
      return this.geminiAIProvider.listModels();
    }

    return this.genericAIProvider.listModels(provider);
  }
}
