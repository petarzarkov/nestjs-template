import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Response } from 'express';
import { ContextService } from '@/infra/logger/services/context.service';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';

/**
 * Generic exception filter that catches all types of exceptions
 * and provides consistent logging and response formatting
 */
@Injectable()
@Catch()
export class GenericExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Catches all exceptions and provides consistent logging and response formatting
   * @param exception The exception that was thrown
   * @param host The arguments host containing request/response context
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    this.contextService.updateContext({
      context:
        this.contextService.getContext().context ||
        'GenericExceptionFilter.catch',
    });

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const responseBody = this.exceptionResponse(exception);
    if (responseBody.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('Server error occurred', {
        error: exception,
        status: responseBody.status,
        responseBody,
      });
    } else {
      this.logger.warn('Client error occurred', {
        error: exception,
        status: responseBody.status,
        responseBody,
      });
    }

    response.status(responseBody.status).json(responseBody);
  }

  private exceptionResponse(exception: unknown) {
    if (exception instanceof HttpException) {
      const errorResponse = exception.getResponse();
      const parsedError =
        typeof errorResponse === 'object'
          ? {
              error:
                'error' in errorResponse
                  ? errorResponse.error
                  : HttpStatus[
                      exception.getStatus() || HttpStatus.INTERNAL_SERVER_ERROR
                    ],
              message:
                'message' in errorResponse
                  ? errorResponse.message
                  : 'An unknown error occurred',
            }
          : {
              error:
                HttpStatus[
                  exception.getStatus() || HttpStatus.INTERNAL_SERVER_ERROR
                ],
              message: errorResponse || 'An unknown error occurred',
            };

      return {
        ...parsedError,
        status: exception?.getStatus() || HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    return {
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unknown error occurred',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }
}
