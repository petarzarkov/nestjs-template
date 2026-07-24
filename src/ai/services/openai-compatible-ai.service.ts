import { ContextLogger } from '@arkv/nestjs-context-logger';
import type { ZodType } from 'zod';
import { FetchService } from '@/core/helpers/services/fetch.service';
import { BaseProviderAiService } from './base-provider-ai.service';

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

interface ChatCompletionChunk {
  choices?: { delta?: { content?: string } }[];
}

interface ModelListResponse {
  data?: { id: string }[];
}

export interface OpenAICompatibleOptions {
  /** OpenAI-compatible API root, e.g. `https://api.groq.com/openai/v1`. */
  baseUrl: string;
  apiKey: string;
  temperature: number;
  /** Time-to-first-response budget for streaming, in ms. */
  streamTimeout: number;
  /** Used in flow names / error messages. */
  label: string;
  /** Model used when the caller doesn't pin one. */
  defaultModel: string;
  /** Fallback model ids when the live `/models` listing can't be fetched. */
  staticModels: string[];
}

/**
 * Base for any provider exposing an OpenAI-compatible `/chat/completions`
 * endpoint (Groq, OpenRouter, …). Non-streaming calls go through
 * {@link FetchService} (retry + back-off + 429/5xx handling + logging);
 * streaming reads the SSE body with raw `fetch`. No SDK, no extra dependency.
 *
 * Structured output uses `response_format: { type: 'json_object' }` rather than
 * the strict `json_schema` mode (rejected by most Groq models): json_object
 * guarantees valid JSON but not field names, so we hand the model the expected
 * shape (from the Zod schema) and Zod-validate the reply.
 */
export abstract class OpenAICompatibleAiService extends BaseProviderAiService {
  protected constructor(
    protected readonly fetchService: FetchService,
    logger: ContextLogger,
    protected readonly options: OpenAICompatibleOptions,
  ) {
    super(logger);
  }

  get configured(): boolean {
    return Boolean(this.options.apiKey);
  }

  async generateText(
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): Promise<string> {
    return this.chat(model, this.buildMessages(prompt, systemPrompt), false);
  }

  async generateStructured<T>(
    model: string,
    prompt: string,
    schema: ZodType<T>,
    systemPrompt?: string,
  ): Promise<T> {
    const shape = this.jsonInstruction(schema);
    const system = systemPrompt ? `${systemPrompt}\n\n${shape}` : shape;
    const raw = await this.chat(
      model,
      this.buildMessages(prompt, system),
      true,
    );
    return this.parseJson(raw, schema);
  }

  async *streamText(
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): AsyncGenerator<string> {
    if (!this.options.apiKey) {
      throw new Error(`${this.options.label} provider not configured`);
    }

    const events = this.fetchService.streamSse(
      `${this.options.baseUrl}/chat/completions`,
      {
        model: model || this.options.defaultModel,
        temperature: this.options.temperature,
        stream: true,
        messages: this.buildMessages(prompt, systemPrompt),
      },
      {
        headers: this.authHeaders(),
        flow: `${this.options.label}:stream`,
        timeoutMs: this.options.streamTimeout,
      },
    );

    for await (const data of events) {
      try {
        const chunk = JSON.parse(data) as ChatCompletionChunk;
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch {
        // keep-alive comment or partial SSE frame — ignore
      }
    }
  }

  async listModels(): Promise<string[]> {
    if (!this.options.apiKey) {
      return [];
    }
    try {
      const data = await this.fetchService.get<ModelListResponse>(
        `${this.options.baseUrl}/models`,
        { headers: this.authHeaders(), flow: `${this.options.label}:models` },
      );
      const ids = data?.data?.map(m => m.id) ?? [];
      return ids.length ? ids : this.options.staticModels;
    } catch {
      return this.options.staticModels;
    }
  }

  /** json_object mode requires the literal word "json" in the prompt. */
  private jsonInstruction<T>(schema: ZodType<T>): string {
    return (
      'Respond with a single JSON object — no markdown, no prose — that matches ' +
      `this JSON schema exactly:\n${JSON.stringify(this.jsonSchema(schema))}`
    );
  }

  private buildMessages(prompt: string, systemPrompt?: string): ChatMessage[] {
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    return messages;
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.options.apiKey}` };
  }

  private async chat(
    model: string,
    messages: ChatMessage[],
    json: boolean,
  ): Promise<string> {
    if (!this.options.apiKey) {
      throw new Error(`${this.options.label} provider not configured`);
    }

    const data = await this.fetchService.post<unknown, ChatCompletionResponse>(
      `${this.options.baseUrl}/chat/completions`,
      {
        model: model || this.options.defaultModel,
        temperature: this.options.temperature,
        messages,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      },
      { headers: this.authHeaders(), flow: `${this.options.label}:chat` },
    );

    return data?.choices?.[0]?.message?.content ?? '';
  }
}
