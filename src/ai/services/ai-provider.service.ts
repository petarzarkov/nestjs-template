import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { generateText, streamText } from 'vercel-ai';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { FetchService } from '@/core/helpers/services/fetch.service';
import { ContextLogger } from '@arkv/nestjs-context-logger';
import { AIProvider } from '../enum/ai-provider.enum';

@Injectable()
export class AIProviderService {
  private providers: Map<
    AIProvider,
    ReturnType<typeof createOpenAI | typeof createGoogleGenerativeAI>
  >;
  private config: ValidatedConfig['ai'];

  constructor(
    private readonly configService: AppConfigService<ValidatedConfig>,
    private readonly logger: ContextLogger,
    private readonly fetchService: FetchService,
  ) {
    this.config = this.configService.get('ai');
    this.providers = new Map();
    this.initializeProviders();
  }

  private initializeProviders() {
    const googleConfig = this.config.providers[AIProvider.GOOGLE];
    const groqConfig = this.config.providers[AIProvider.GROQ];
    const openrouterConfig = this.config.providers[AIProvider.OPENROUTER];

    if (googleConfig) {
      this.providers.set(
        AIProvider.GOOGLE,
        createGoogleGenerativeAI({
          apiKey: googleConfig.apiKey,
        }),
      );
    }

    if (groqConfig) {
      this.providers.set(
        AIProvider.GROQ,
        createOpenAI({
          apiKey: groqConfig.apiKey,
          baseURL: groqConfig.url,
        }),
      );
    }

    if (openrouterConfig) {
      this.providers.set(
        AIProvider.OPENROUTER,
        createOpenAI({
          apiKey: openrouterConfig.apiKey,
          baseURL: openrouterConfig.url,
        }),
      );
    }
  }

  private getProvider(provider: AIProvider) {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new InternalServerErrorException(
        `${provider} provider not configured`,
      );
    }
    return providerInstance;
  }

  async queryProvider(
    provider: AIProvider,
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): Promise<string> {
    try {
      const providerInstance = this.getProvider(provider);
      const { text } = await generateText({
        model: providerInstance(model),
        messages: [
          ...(systemPrompt
            ? [{ role: 'system' as const, content: systemPrompt }]
            : []),
          { role: 'user' as const, content: prompt },
        ],
        temperature: this.config.defaults.temperature,
      });

      return text;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : 'UnknownError';

      this.logger.error(`Query error from ${provider} provider`, {
        errorMessage,
        errorName,
        model,
      });

      throw error;
    }
  }

  async *streamProvider(
    provider: AIProvider,
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): AsyncGenerator<string> {
    const providerInstance = this.getProvider(provider);
    const { textStream } = streamText({
      model: providerInstance(model),
      messages: [
        ...(systemPrompt
          ? [{ role: 'system' as const, content: systemPrompt }]
          : []),
        { role: 'user' as const, content: prompt },
      ],
      temperature: this.config.defaults.temperature,
      onError: error => {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const errorName = error instanceof Error ? error.name : 'UnknownError';

        this.logger.error(`Stream error from ${provider} provider`, {
          errorMessage,
          errorName,
          model,
        });

        // Re-throw to ensure error propagates to catch block
        throw error;
      },
    });

    for await (const chunk of textStream) {
      yield chunk;
    }
  }

  async listModels(provider: AIProvider): Promise<string[]> {
    const providerConfig = this.config.providers[provider];
    if (!providerConfig) {
      return [];
    }

    try {
      // Fetch models dynamically from provider APIs
      if (provider === AIProvider.GROQ || provider === AIProvider.OPENROUTER) {
        const data = await this.fetchService.get<{
          data?: { id: string }[];
        }>(`${providerConfig.url}/models`, {
          headers: { Authorization: `Bearer ${providerConfig.apiKey}` },
          flow: `ai:${provider}`,
        });
        return data.data?.map(model => model.id) || [];
      }

      if (provider === AIProvider.GOOGLE) {
        // Auth via header (not `?key=`) so the key never lands in a logged URL.
        const data = await this.fetchService.get<{
          models?: {
            name: string;
            supportedGenerationMethods?: string[];
          }[];
        }>(providerConfig.url, {
          headers: { 'x-goog-api-key': providerConfig.apiKey },
          flow: `ai:${provider}`,
        });
        return (
          data.models
            ?.filter(model =>
              model.supportedGenerationMethods?.includes('generateContent'),
            )
            .map(model => model.name.replace('models/', '')) || []
        );
      }

      return [];
    } catch {
      // FetchService already logged (and retried) the failure; degrade
      // gracefully to the static model list.
      return this.getStaticModels(provider);
    }
  }

  private getStaticModels(provider: AIProvider): string[] {
    switch (provider) {
      case AIProvider.GROQ:
        return [
          'llama-3.3-70b-versatile',
          'llama-3.1-8b-instant',
          'mixtral-8x7b-32768',
        ];
      case AIProvider.OPENROUTER:
        return [
          'anthropic/claude-3.5-sonnet',
          'openai/gpt-4-turbo',
          'meta-llama/llama-3.1-70b-instruct',
        ];
      case AIProvider.GOOGLE:
        return ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'];
      default:
        return [];
    }
  }
}
