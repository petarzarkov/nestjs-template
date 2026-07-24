import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ContextLogger, ContextService } from '@arkv/nestjs-context-logger';
import { UrlHelper } from '@arkv/shared';
import type { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import {
  type ErrorHandler,
  FetchHttpError,
  type FetchRequestConfig,
} from '../types/fetch-request.type';
import { HelpersService } from './helpers.service';

type BaseOptions<TReq, TRes> = Omit<
  FetchRequestConfig<TReq, TRes>,
  'method' | 'url' | 'payload'
>;

/**
 * `fetch`-based HTTP client with per-request timeout, retry/backoff (via
 * HelpersService), async-context-scoped logging and consistent NestJS error
 * mapping. Preferred over plain `fetch` so every outbound call is logged,
 * retried and surfaced uniformly.
 */
@Injectable()
export class FetchService extends UrlHelper {
  private readonly httpConfig: ValidatedConfig['http'];

  constructor(
    private readonly helpersService: HelpersService,
    private readonly contextService: ContextService,
    private readonly logger: ContextLogger,
    configService: AppConfigService<ValidatedConfig>,
  ) {
    super();
    this.httpConfig = configService.getOrThrow('http');
  }

  async request<TRequest = unknown, TResponse = unknown>(
    config: FetchRequestConfig<TRequest, TResponse>,
  ): Promise<TResponse> {
    const {
      method,
      url: baseUrl,
      payload,
      headers: customHeaders,
      path,
      pathParams,
      queryParams,
      timeoutMs = this.httpConfig.timeout,
      headerFactory,
      errorHandler,
      flow,
      retryOptions,
    } = config;

    const startedAt = Date.now();
    let attempts = 0;
    let lastUrl: URL | undefined;
    let lastStatus: number | undefined;

    const doCall = () =>
      this.helpersService.executeWithRetry(
        async () => {
          attempts++;
          const url = this.buildUrl({
            base: baseUrl,
            path,
            pathParams,
            queryParams,
          });
          lastUrl = url;

          // Determine whether to JSON-serialize or pass through as raw BodyInit.
          const isJsonPayload =
            payload != null &&
            typeof payload === 'object' &&
            !(payload instanceof FormData) &&
            !(payload instanceof URLSearchParams) &&
            !(payload instanceof Blob) &&
            !(payload instanceof ArrayBuffer);
          const bodyString = isJsonPayload
            ? this.helpersService.safeStringify(
                payload as Record<string, unknown>,
              )
            : '';
          const body: BodyInit | undefined =
            payload != null
              ? isJsonPayload
                ? bodyString
                : (payload as BodyInit)
              : undefined;

          const authHeaders = headerFactory?.({
            timestamp: Math.floor(Date.now() / 1000),
            method,
            requestPath: url.pathname + url.search,
            body: bodyString,
          });

          const controller = new AbortController();
          const timeoutId = timeoutMs
            ? setTimeout(() => controller.abort(), timeoutMs)
            : undefined;

          let rawResponse: Response | undefined;
          try {
            rawResponse = await fetch(url.href, {
              method,
              headers: {
                Accept: 'application/json',
                ...(isJsonPayload && { 'Content-Type': 'application/json' }),
                ...authHeaders,
                ...customHeaders,
              },
              ...(body != null && { body }),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          lastStatus = rawResponse.status;

          if (!rawResponse.ok) {
            let data: unknown;
            try {
              data = await rawResponse.json();
            } catch {
              data = await rawResponse.text().catch(() => undefined);
            }
            throw new FetchHttpError(
              rawResponse.status,
              rawResponse.statusText,
              data,
            );
          }

          const text = await rawResponse.text();
          if (!text) return undefined as TResponse;
          try {
            return JSON.parse(text) as TResponse;
          } catch {
            return text as unknown as TResponse;
          }
        },
        {
          maxRetries: this.httpConfig.maxRetries,
          retryDelay: this.httpConfig.retryDelay,
          ...retryOptions,
        },
      );

    const describe = () => `HTTP ${method} ${lastUrl?.href ?? String(baseUrl)}`;

    try {
      const result = await this.contextService.runWithContext(
        {
          ...this.contextService.getContext(),
          ...(flow && { flow }),
          event: path ?? String(baseUrl),
        },
        doCall,
      );

      this.logger.debug(`${describe()} succeeded`, {
        status: lastStatus,
        attempts,
        elapsed: Date.now() - startedAt,
        request: payload,
        response: result,
      });

      return result;
    } catch (error) {
      const cleanError =
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
              ...(error instanceof FetchHttpError
                ? {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data,
                  }
                : {}),
            }
          : { message: String(error) };

      this.logger.error(`${describe()} failed`, {
        err: cleanError,
        attempts,
        elapsed: Date.now() - startedAt,
        request: payload,
      });

      if (error instanceof FetchHttpError || error instanceof TypeError) {
        const handler: ErrorHandler =
          errorHandler ?? this.defaultErrorHandler.bind(this);
        throw handler(error as FetchHttpError | TypeError);
      }
      throw error;
    }
  }

  /**
   * Streams a Server-Sent-Events response, yielding each `data:` payload string
   * (the terminating `[DONE]` sentinel is consumed, not yielded). Unlike
   * {@link request} there is **no retry** — a partially-consumed stream can't be
   * safely replayed — but the connect timeout, context logging and NestJS error
   * mapping still apply. Callers parse each payload themselves (e.g. `JSON.parse`).
   */
  async *streamSse<TRequest = unknown>(
    url: string | URL,
    payload?: TRequest,
    options: {
      headers?: Record<string, string>;
      flow?: string;
      /** Time-to-first-byte budget in ms; the stream itself is not capped. */
      timeoutMs?: number;
      method?: 'GET' | 'POST';
    } = {},
  ): AsyncGenerator<string> {
    const {
      headers,
      flow,
      timeoutMs = this.httpConfig.timeout,
      method = 'POST',
    } = options;
    const target = this.buildUrl({ base: url });
    const startedAt = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(target.href, {
        method,
        headers: {
          Accept: 'text/event-stream',
          ...(payload != null && { 'Content-Type': 'application/json' }),
          ...headers,
        },
        ...(payload != null && {
          body: this.helpersService.safeStringify(
            payload as Record<string, unknown>,
          ),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      this.logger.error(`HTTP STREAM ${target.href} failed to connect`, {
        err: error instanceof Error ? error.message : String(error),
        flow,
      });
      throw error instanceof TypeError
        ? this.defaultErrorHandler(error)
        : error;
    } finally {
      // Headers received (or the connect failed) — drop the connect guard so a
      // long-lived stream isn't aborted mid-flight.
      clearTimeout(timer);
    }

    if (!response.ok || !response.body) {
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        data = await response.text().catch(() => undefined);
      }
      this.logger.error(`HTTP STREAM ${target.href} failed`, {
        err: { status: response.status, data },
        flow,
      });
      throw this.defaultErrorHandler(
        new FetchHttpError(response.status, response.statusText, data),
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith('data:')) {
            continue;
          }
          const data = line.slice(5).trim();
          if (data === '[DONE]') {
            return;
          }
          yield data;
        }
      }
    } finally {
      reader.releaseLock();
      this.logger.debug(`HTTP STREAM ${target.href} closed`, {
        flow,
        elapsed: Date.now() - startedAt,
      });
    }
  }

  get<TResponse = unknown>(
    url: string | URL,
    options?: BaseOptions<never, TResponse>,
  ): Promise<TResponse> {
    return this.request<never, TResponse>({ method: 'GET', url, ...options });
  }

  post<TRequest = unknown, TResponse = unknown>(
    url: string | URL,
    payload?: TRequest,
    options?: BaseOptions<TRequest, TResponse>,
  ): Promise<TResponse> {
    return this.request<TRequest, TResponse>({
      method: 'POST',
      url,
      payload,
      ...options,
    });
  }

  put<TRequest = unknown, TResponse = unknown>(
    url: string | URL,
    payload?: TRequest,
    options?: BaseOptions<TRequest, TResponse>,
  ): Promise<TResponse> {
    return this.request<TRequest, TResponse>({
      method: 'PUT',
      url,
      payload,
      ...options,
    });
  }

  patch<TRequest = unknown, TResponse = unknown>(
    url: string | URL,
    payload?: TRequest,
    options?: BaseOptions<TRequest, TResponse>,
  ): Promise<TResponse> {
    return this.request<TRequest, TResponse>({
      method: 'PATCH',
      url,
      payload,
      ...options,
    });
  }

  delete<TResponse = unknown>(
    url: string | URL,
    options?: BaseOptions<never, TResponse>,
  ): Promise<TResponse> {
    return this.request<never, TResponse>({
      method: 'DELETE',
      url,
      ...options,
    });
  }

  private defaultErrorHandler(error: FetchHttpError | TypeError): Error {
    if (!(error instanceof FetchHttpError)) {
      return new InternalServerErrorException(error.message);
    }

    const { status, data } = error.response;
    let message = error.message;
    if (data && typeof data === 'object' && 'message' in data) {
      message = (data as Record<string, unknown>).message as string;
    } else if (typeof data === 'string') {
      message = data;
    }

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return new BadRequestException(message);
      case HttpStatus.UNAUTHORIZED:
        return new UnauthorizedException(message);
      case HttpStatus.FORBIDDEN:
        return new ForbiddenException(message);
      case HttpStatus.NOT_FOUND:
        return new NotFoundException(message);
      case HttpStatus.CONFLICT:
        return new ConflictException(message);
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return new UnprocessableEntityException(message);
      default:
        return new InternalServerErrorException(message);
    }
  }
}
