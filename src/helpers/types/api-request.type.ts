import type { HttpService } from '@nestjs/axios';
import type { AxiosError } from 'axios';
import type { ContextLogger } from '@/logger/services/context-logger.service';
import type { HttpMethod } from './http-method.type';
import type { ParamsType } from './params.type';
import type { RetryOptions } from './retry-options.type';

export type HeaderFactory = (params: {
  timestamp: number;
  method: HttpMethod;
  requestPath: string;
  /**
   * @default ''
   */
  body: string;
}) => Record<string, string>;

export type ErrorHandler = (error: AxiosError) => Error;

export interface ApiRequestConfig<TRequest, TResponse> {
  method: HttpMethod;
  endpoint?: string;
  payload?: TRequest;
  pathParams?: ParamsType;
  queryParams?: ParamsType;
  retryOptions?: Partial<RetryOptions<TResponse>>;
  timeoutMs?: number;
}

export interface AuthenticatedApiRequestConfig<TRequest, TResponse> {
  flow: string;
  baseUrl: string;
  httpService: HttpService;
  config: ApiRequestConfig<TRequest, TResponse>;
  headerFactory?: HeaderFactory;
  logger?: ContextLogger;
  errorHandler?: ErrorHandler;
}
