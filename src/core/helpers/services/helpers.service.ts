import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SECOND } from '@/constants';
import { ContextLogger } from '@arkv/nestjs-context-logger';
import { RetryOptions } from '../types/retry-options.type';
import { UrlHelper } from '@arkv/shared';

/**
 * Image formats `Bun.Image` decodes on every platform via statically-linked
 * codecs (HEIC/AVIF/TIFF are OS-specific and intentionally excluded so behavior
 * is portable across Linux containers, macOS, and Windows).
 */
const SUPPORTED_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
] as const;

@Injectable()
export class HelpersService extends UrlHelper {
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
      retryDelay = SECOND,
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

  private calculateBackoffDelay(
    attempt: number,
    baseDelay: number,
    power = 2,
    jitter = 1000,
    maxDelay = 30000,
  ): number {
    const exponentialDelay = baseDelay * power ** attempt;
    const randomJitter = Math.random() * jitter;
    return Math.min(exponentialDelay + randomJitter, maxDelay);
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

  safeStringify(obj: Record<string, unknown>): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (_, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  }

  isPlainObject(obj: unknown): obj is Record<string, unknown> {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      !Array.isArray(obj) &&
      !(obj instanceof Error)
    );
  }

  isSupportedImageType(extension: string): boolean {
    return SUPPORTED_IMAGE_EXTENSIONS.includes(
      extension.toLowerCase() as (typeof SUPPORTED_IMAGE_EXTENSIONS)[number],
    );
  }

  /**
   * Reads image dimensions from a buffer using the built-in `Bun.Image` API
   * (no native `image-size` dependency). Detection is content-based; returns
   * `null` for unsupported extensions or undecodable/corrupt data.
   */
  async calculateImageSize(
    file: {
      id: string;
      buffer: Buffer;
      extension: string;
      mimetype: string;
    },
    logger: ContextLogger,
  ): Promise<{ width: number; height: number } | null> {
    // Only process files with valid image extensions
    const isImageType = this.isSupportedImageType(file.extension);

    if (!isImageType) {
      logger?.log(`File ${file.id} is not a supported image type`, {
        extension: file.extension,
        supportedExtensions: SUPPORTED_IMAGE_EXTENSIONS,
        mimetype: file.mimetype,
      });
      return null;
    }

    try {
      const { width, height } = await new Bun.Image(file.buffer).metadata();
      logger?.debug('Image size calculated', {
        id: file.id,
        width,
        height,
      });
      return { width, height };
    } catch (error) {
      // Skip files that can't be processed (corrupted images, etc.)
      logger?.warn(`Failed to calculate image size for file ${file.id}`, {
        error,
        extension: file.extension,
        mimetype: file.mimetype,
        bufferSize: file.buffer?.length || 0,
        bufferStart:
          file.buffer?.length > 0
            ? file.buffer
                .subarray(0, Math.min(16, file.buffer.length))
                .toString('hex')
            : 'empty',
      });
    }

    return null;
  }
}
