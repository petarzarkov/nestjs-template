import { GoogleGenAI, Model } from '@google/genai';
import {
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { HelpersService } from '@/helpers/services/helpers.service';
import { ContextLogger } from '@/logger/services/context-logger.service';

@Injectable()
export class GeminiAIProvider {
  private config: ValidatedConfig['ai'];

  constructor(
    @Inject(GoogleGenAI) private readonly genAI: GoogleGenAI,
    private readonly configService: AppConfigService<ValidatedConfig>,
    private readonly helpersService: HelpersService,
    private readonly logger: ContextLogger,
  ) {
    this.config = this.configService.getOrThrow('ai');
  }

  async queryProvider(
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): Promise<string> {
    const result = await this.helpersService.executeWithRetry(
      async () => {
        return await this.genAI.models.generateContent({
          model,
          contents: [
            ...(systemPrompt ? [{ parts: [{ text: systemPrompt }] }] : []),
            { parts: [{ text: prompt }] },
          ],
          config: {
            temperature: this.config.defaults.temperature,
          },
        });
      },
      {
        maxRetries: 3,
        retryDelay: 1000,
        shouldRetryOnStatus: (status: number) => {
          return (
            status >= HttpStatus.INTERNAL_SERVER_ERROR ||
            status === HttpStatus.REQUEST_TIMEOUT
          );
        },
        onAttempt: (attempt: number, isRetry: boolean) => {
          this.logger.debug('Attempting to query gemini provider', {
            attempt,
            isRetry,
          });
        },
        onSuccess: (result: unknown, attempt: number) => {
          this.logger.debug('Successfully queried gemini provider', {
            result,
            attempt,
          });
        },
      },
    );

    if (!result || !result.candidates || result.candidates.length === 0) {
      throw new InternalServerErrorException(
        'No response candidates from gemini provider',
      );
    }

    const candidate = result.candidates[0];
    if (
      !candidate.content ||
      !candidate.content.parts ||
      candidate.content.parts.length === 0
    ) {
      throw new InternalServerErrorException(
        'Invalid response structure from gemini provider',
      );
    }

    const text = candidate.content.parts[0].text;
    if (!text) {
      throw new InternalServerErrorException(
        'Empty response from gemini provider',
      );
    }

    return text;
  }

  async listModels(): Promise<string[]> {
    const result = await this.genAI.models.list();
    if (!result || !result.page || result.page.length === 0) {
      throw new InternalServerErrorException(
        'No models found from gemini provider',
      );
    }

    return result.page.map((model: Model) => model.name || 'unknown');
  }
}
