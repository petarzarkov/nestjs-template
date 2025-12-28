import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { HelpersService } from '@/helpers/services/helpers.service';
import { ApiRequestConfig } from '@/helpers/types/api-request.type';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { AIProvider } from '../enum/ai-provider.enum';

@Injectable()
export class OpenAIProvider {
  private config: ValidatedConfig['ai'];

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: AppConfigService<ValidatedConfig>,
    private readonly helpersService: HelpersService,
    private readonly logger: ContextLogger,
  ) {
    this.config = this.configService.getOrThrow('ai');
  }

  private makeAuthorizedRequest<TRequest, TResponse>(
    provider: AIProvider,
    config: ApiRequestConfig<TRequest, TResponse>,
  ): Promise<TResponse> {
    const providerConfig = this.config.providers[provider];
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not configured`);
    }

    return this.helpersService.makeExternalApiCall<TRequest, TResponse>({
      flow: 'openapi-ai',
      baseUrl: providerConfig.url,
      httpService: this.httpService,
      headerFactory: () => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providerConfig.apiKey}`,
      }),
      logger: this.logger,
      config,
    });
  }

  async queryProvider(
    provider: AIProvider,
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): Promise<string> {
    const result = await this.makeAuthorizedRequest<
      unknown,
      {
        choices: {
          message: {
            content: string;
          };
        }[];
      }
    >(provider, {
      method: 'POST',
      endpoint: '/chat/completions',
      payload: {
        model: model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
      },
    });
    if (!result || !result.choices || result.choices.length === 0) {
      throw new InternalServerErrorException(
        `Invalid response structure from ${provider} provider`,
      );
    }

    return result.choices[0].message.content || 'unknown';
  }

  async listModels(provider: AIProvider): Promise<string[]> {
    const result = await this.makeAuthorizedRequest<
      unknown,
      {
        data: {
          id: string;
        }[];
      }
    >(provider, {
      method: 'GET',
      endpoint: '/models',
    });
    if (!result || !result.data || !result.data || result.data.length === 0) {
      throw new InternalServerErrorException(
        `No models found from ${provider} provider`,
      );
    }

    return result.data.map(model => model.id);
  }
}
