import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AxiosError, AxiosRequestConfig } from 'axios';
import Decimal from 'decimal.js';
import { firstValueFrom } from 'rxjs';
import { AuthenticatedApiRequestConfig } from '../types/api-request.type';
import { ParamsType } from '../types/params.type';
import { RetryOptions } from '../types/retry-options.type';

@Injectable()
export class HelpersService {
  buildUrl(config: {
    base: string | URL;
    path?: string;
    queryParams?: ParamsType;
    pathParams?: ParamsType;
  }): URL {
    const { base, path, queryParams, pathParams } = config;
    const urlString = typeof base === 'string' ? base : base.href;
    const baseUrlReplaced = this.interpolate(urlString, pathParams);
    const pathReplaced = path && this.interpolate(path, pathParams);
    const baseUrlFinal = this.#buildUrlFromString(
      baseUrlReplaced,
      pathReplaced,
    );
    return this.#buildUrlWithQuery(baseUrlFinal, queryParams);
  }

  #buildUrlWithQuery(baseUrl: string | URL, queryParams?: ParamsType): URL {
    const url =
      typeof baseUrl === 'string' ? this.#buildUrlFromString(baseUrl) : baseUrl;

    if (queryParams) {
      Object.keys(queryParams).forEach(key => {
        const value = queryParams[key];
        if (value != null) {
          url.searchParams.set(key, value.toString());
        }
      });
    }

    return url;
  }

  #buildUrlFromString(baseUrl: string, path?: string): URL {
    const urlObject = new URL(baseUrl);

    if (path) {
      // Remove leading slash from path if present
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;

      // Combine the pathname with the new path
      const existingPath = urlObject.pathname.endsWith('/')
        ? urlObject.pathname
        : `${urlObject.pathname}/`;
      urlObject.pathname = existingPath + cleanPath;
    }

    return urlObject;
  }

  interpolate(template: string, params?: ParamsType): string {
    if (!params) {
      return template;
    }

    let result = template;
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value != null) {
        result = result.replace(
          new RegExp(`\\{${key}\\}`, 'gi'),
          value.toString(),
        );
      }
    });

    return result;
  }

  createStopwatch(): {
    getElapsedMs: () => number;
  } {
    const startTime = Date.now();
    return {
      getElapsedMs: (): number => Date.now() - startTime,
    };
  }

  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async executeWithRetry<T>(
    operation: () => Promise<T> | T,
    config?: Partial<RetryOptions<T>>,
  ): Promise<T> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      shouldRetryOnStatus = (status: number) => {
        // Retry 5xx server errors and other retryable status codes
        return (
          status >= HttpStatus.INTERNAL_SERVER_ERROR ||
          status === HttpStatus.REQUEST_TIMEOUT ||
          status === HttpStatus.CONFLICT ||
          status === HttpStatus.UNPROCESSABLE_ENTITY ||
          status === HttpStatus.TOO_MANY_REQUESTS
        );
      },
      onAttempt,
      onError,
      onSuccess,
    } = config || {};

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        onAttempt?.(attempt + 1, attempt > 0);

        const result = await operation();

        onSuccess?.(result, attempt + 1);
        return result;
      } catch (err) {
        lastError = err as Error;

        const isAborted = lastError.message?.toLowerCase().includes('abort');

        // Check if it's an HTTP response error with status
        const httpError = lastError as Error & { status?: number };
        const status =
          lastError instanceof HttpException
            ? lastError.getStatus()
            : httpError.status;
        const shouldRetryStatus = status
          ? shouldRetryOnStatus(status as HttpStatus)
          : true; // Retry non-HTTP errors by default

        const willRetry = shouldRetryStatus && !isAborted;

        onError?.(lastError, attempt + 1, willRetry);

        if (willRetry) {
          await this.delay(this.calculateBackoffDelay(attempt, retryDelay));
          continue;
        }

        // If we shouldn't retry or this is the last attempt, throw the error
        throw lastError;
      }
    }

    throw lastError || new Error('Operation failed after all retries');
  }

  /**
   * Converts a network ID to an Ethereum network name
   * Network names are used in Tokeny API
   * @param networkId Network ID
   * @returns Ethereum network name
   */
  networkIdToEthereumNetwork(networkId: number): string {
    switch (networkId) {
      case 84532:
        return 'BASE_SEPOLIA';
      case 8453:
        return 'BASE';
      default:
        throw new Error(`Unsupported network ID: ${networkId}`);
    }
  }

  convertToDecimals(input: string, decimals: number = 18): string {
    const decimal = new Decimal(input);
    return decimal.toFixed(decimals);
  }

  isValidDecimal(value: Decimal): boolean {
    return value.isFinite() && !value.isNaN();
  }

  private calculateBackoffDelay(attempt: number, baseDelay: number): number {
    // Exponential backoff with jitter: baseDelay * (2^attempt) + random(0, 1000)
    const exponentialDelay = baseDelay * 2 ** attempt;
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  defaultErrorHandler(error: AxiosError): Error {
    const status = error.response?.status;
    const responseData = error.response?.data;

    // Extract meaningful error message from API response
    let message = error.message;
    if (responseData) {
      if (typeof responseData === 'object' && 'message' in responseData) {
        message = responseData.message as string;
      } else if (typeof responseData === 'string') {
        message = responseData;
      }
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

  public async makeExternalApiCall<TRequest, TResponse>(
    params: AuthenticatedApiRequestConfig<TRequest, TResponse>,
  ): Promise<TResponse> {
    const {
      flow,
      httpService,
      config,
      headerFactory,
      baseUrl,
      logger,
      errorHandler,
    } = params || {};

    const {
      method,
      endpoint,
      payload,
      pathParams,
      queryParams,
      retryOptions,
      timeoutMs,
    } = config || {};

    try {
      return await this.executeWithRetry(
        async () => {
          const url = this.buildUrl({
            base: baseUrl,
            path: endpoint,
            pathParams,
            queryParams,
          });

          const bodyString = payload ? JSON.stringify(payload) : '';
          const headers = headerFactory?.({
            timestamp: Math.floor(Date.now() / 1000),
            method,
            requestPath: url.pathname + url.search,
            body: bodyString,
          });

          const axiosConfig: AxiosRequestConfig<TRequest> = {
            method,
            url: url.href,
            headers,
            ...(payload != null && { data: payload }),
            ...(timeoutMs && { timeout: timeoutMs }),
          };

          const response = await firstValueFrom(
            httpService.request<TResponse>(axiosConfig),
          );
          if (!response) {
            throw new InternalServerErrorException(
              `No response received from ${method} ${url.href}`,
            );
          }

          return response.data;
        },
        {
          ...retryOptions,
          onAttempt:
            retryOptions?.onAttempt ||
            ((attempt, isRetry) => {
              logger?.log(
                `External API call: ${flow} ${method} ${endpoint} (Attempt ${attempt}${isRetry ? ' (retry)' : ''})`,
                { request: payload },
              );
            }),
          onSuccess:
            retryOptions?.onSuccess ||
            ((response, attempt) => {
              logger?.log(
                `External API call: ${flow} ${method} ${endpoint} successful (Attempt ${attempt})`,
                { response },
              );
            }),
          onError:
            retryOptions?.onError ||
            ((error, attempt, willRetry) => {
              const cleanError: Record<string, unknown> = {
                message: error.message,
                name: error.name,
                stack: error.stack,
                ...(error instanceof AxiosError
                  ? {
                      code: error.code,
                      ...(error.response && {
                        status: error.response.status,
                        statusText: error.response.statusText,
                        ...(error.response.data && {
                          data: error.response.data,
                        }),
                      }),
                    }
                  : {}),
              };

              logger?.error(
                `External API call failed: ${flow} ${method} ${endpoint}`,
                {
                  err: cleanError,
                  attempt,
                  willRetry,
                },
              );
            }),
        },
      );
    } catch (error) {
      // Use provided error handler or default error handler for AxiosError
      if (error instanceof AxiosError) {
        const handler = errorHandler || this.defaultErrorHandler.bind(this);
        throw handler(error);
      }
      // Re-throw non-axios errors as-is
      throw error;
    }
  }

  /**
   * Try to parse a timestamp string to a Date object
   * @param timestamp Timestamp string
   * @returns Date object
   */
  tryParseTimestamp(timestamp: string): Date {
    try {
      const numericTimestamp = parseInt(timestamp, 10);
      if (Number.isNaN(numericTimestamp)) {
        return new Date();
      }

      return new Date(numericTimestamp);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      return new Date();
    }
  }
}
