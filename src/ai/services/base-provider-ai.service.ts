import { ContextLogger } from '@arkv/nestjs-context-logger';
import { z, type ZodType } from 'zod';

/**
 * Shared machinery for the per-provider AI services ({@link GoogleAIService},
 * {@link OpenAICompatibleAiService} and its subclasses). Each talks to its
 * provider's own SDK/REST API rather than a generic third-party abstraction
 * (no `vercel-ai`, no `@ai-sdk/*`), but they all need to coerce a JSON string
 * into a typed, Zod-validated object and recognise quota/rate-limit failures.
 */
export abstract class BaseProviderAiService {
  protected constructor(protected readonly logger: ContextLogger) {}

  /** Whether the provider has an API key — unconfigured ones are skipped. */
  abstract get configured(): boolean;

  abstract generateText(
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): Promise<string>;

  abstract generateStructured<T>(
    model: string,
    prompt: string,
    schema: ZodType<T>,
    systemPrompt?: string,
  ): Promise<T>;

  abstract streamText(
    model: string,
    prompt: string,
    systemPrompt?: string,
  ): AsyncGenerator<string>;

  abstract listModels(): Promise<string[]>;

  /** Best-effort numeric HTTP status pulled off an arbitrary thrown error. */
  protected statusOf(err: unknown): number | undefined {
    if (typeof err === 'object' && err !== null && 'status' in err) {
      const status = (err as Record<string, unknown>).status;
      if (status !== undefined && status !== null) return Number(status);
    }
    return undefined;
  }

  /** A hard quota / rate-limit signal, by status code or message shape. */
  protected is429(err: unknown): boolean {
    if (this.statusOf(err) === 429) return true;
    const msg = err instanceof Error ? err.message : String(err);
    return /\b429\b|resource_exhausted|quota|rate.?limit|too.?many/i.test(msg);
  }

  /**
   * Zod → JSON Schema for handing the expected output shape to a provider, minus
   * the `$schema` draft URL — Gemini's `responseJsonSchema` rejects unsupported
   * top-level keys, and it's noise inside a prompt for the REST providers.
   */
  protected jsonSchema<T>(schema: ZodType<T>): Record<string, unknown> {
    const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<
      string,
      unknown
    >;
    return rest;
  }

  /** Strip an optional ```json / ``` fence and Zod-parse the JSON body. */
  protected parseJson<T>(raw: string, schema: ZodType<T>): T {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    return schema.parse(JSON.parse(cleaned.trim()));
  }
}
