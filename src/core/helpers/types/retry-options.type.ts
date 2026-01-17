export interface RetryOptions<T> {
  maxRetries: number;
  retryDelay: number;
  shouldRetryOnStatus: (status: number) => boolean;
  onAttempt: (attempt: number, isRetry: boolean) => void;
  onError: (error: Error, attempt: number, willRetry: boolean) => void;
  onSuccess: (result: T, attempt: number) => void;
}
