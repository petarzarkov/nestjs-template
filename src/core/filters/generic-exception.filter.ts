import { ContextLogger } from '@/logger/services/context-logger.service';
import { ContextService } from '@/logger/services/context.service';
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Generic exception filter that catches all types of exceptions
 * and provides consistent logging and response formatting
 */
@Injectable()
@Catch()
export class GenericExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService
  ) {}

  /**
   * Catches all exceptions and provides consistent logging and response formatting
   * @param exception The exception that was thrown
   * @param host The arguments host containing request/response context
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    this.contextService.updateContext({
      context: this.contextService.getContext().context || 'GenericExceptionFilter.catch',
    });

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { httpException, status } = this.createHttpException(exception);
    let responseBody: string | object = httpException.getResponse();

    // Enhance BadRequestException with errorFields if it contains validation errors
    if (
      httpException instanceof BadRequestException &&
      status === HttpStatus.BAD_REQUEST &&
      responseBody instanceof Object
    ) {
      const enhancedResponse = this.enhanceBadRequestResponse(
        responseBody as Record<string, unknown>
      );
      responseBody = enhancedResponse as string | object;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('Server error occurred', {
        error: exception,
        status: status,
        responseBody: responseBody,
      });
    } else {
      this.logger.warn('Client error occurred', {
        error: exception,
        status: status,
        responseBody: responseBody,
      });
    }

    response.status(status).json(responseBody);
  }

  /**
   * Creates appropriate HTTP exception and determines status code
   */
  private createHttpException(exception: unknown): {
    httpException: HttpException;
    status: number;
  } {
    // If it's already an HttpException, return it as is
    if (exception instanceof HttpException) {
      return {
        httpException: exception,
        status: exception.getStatus(),
      };
    }

    // Handle regular Error objects
    if (exception instanceof Error) {
      return {
        httpException: new InternalServerErrorException(exception.message),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    // Handle string errors
    if (typeof exception === 'string') {
      return {
        httpException: new InternalServerErrorException(exception),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    // Handle object errors
    if (typeof exception === 'object' && exception !== null) {
      const errorObj = exception as Record<string, unknown>;
      const message =
        'message' in errorObj && typeof errorObj.message === 'string'
          ? errorObj.message
          : 'Unknown error';

      return {
        httpException: new InternalServerErrorException(message),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    // Default fallback
    return {
      httpException: new InternalServerErrorException('An unknown error occurred'),
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }

  private enhanceBadRequestResponse(responseBody: Record<string, unknown> | null) {
    if (responseBody === null) {
      return responseBody;
    }

    if ('errorFields' in responseBody) {
      return responseBody;
    }

    if ('message' in responseBody) {
      const message = responseBody.message;
      if (Array.isArray(message)) {
        const errorFields = message.map((error: unknown, index: number) => {
          if (typeof error === 'string') {
            // Handle special case: "property 'fieldName' should not exist"
            const propertyMatch = error.match(/property '([^']+)' should not exist/);
            if (propertyMatch) {
              return {
                field: propertyMatch[1],
                error,
              };
            }

            const fieldMatch = error.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
            const field = fieldMatch ? fieldMatch[1] : `field${index}`;

            return {
              field,
              error,
            };
          }
          return {
            field: `field${index}`,
            error: String(error),
          };
        });

        return {
          ...responseBody,
          errorFields,
        };
      }
    }

    return responseBody;
  }
}
