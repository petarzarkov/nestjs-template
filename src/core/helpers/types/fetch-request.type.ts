import type { ParamsType } from '@arkv/shared';
import type { HttpMethod } from './http-method.type';
import type { RetryOptions } from './retry-options.type';

/** Thrown for any non-2xx response; carries the parsed body for inspection. */
export class FetchHttpError extends Error {
  readonly status: number;
  readonly response: { status: number; statusText: string; data: unknown };

  constructor(status: number, statusText: string, data: unknown) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = 'FetchHttpError';
    this.status = status;
    this.response = { status, statusText, data };
  }
}

export type HeaderFactory = (params: {
  timestamp: number;
  method: HttpMethod;
  requestPath: string;
  /** @default '' */
  body: string;
}) => Record<string, string>;

export type ErrorHandler = (error: FetchHttpError | TypeError) => Error;

export interface FetchRequestConfig<TRequest = unknown, TResponse = unknown> {
  method: HttpMethod;
  url: string | URL;
  payload?: TRequest;
  /** Extra headers merged on top of the defaults and any `headerFactory` output. */
  headers?: Record<string, string>;
  /** Path segment appended to `url` (supports `{param}` interpolation). */
  path?: string;
  pathParams?: ParamsType;
  queryParams?: ParamsType;
  /** Per-request timeout in ms. Overrides the module-level default when set. */
  timeoutMs?: number;
  /** Called once per attempt to produce HMAC / auth headers from the request body and timestamp. */
  headerFactory?: HeaderFactory;
  /** Maps a `FetchHttpError` or `TypeError` to the exception thrown to the caller. */
  errorHandler?: ErrorHandler;
  /** Logical flow name — merged into the async context for the duration of this call. */
  flow?: string;
  retryOptions?: Partial<RetryOptions<TResponse>>;
}
