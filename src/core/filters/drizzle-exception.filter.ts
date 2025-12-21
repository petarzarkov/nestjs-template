import { ContextLogger } from '@/logger/services/context-logger.service';
import { ContextService } from '@/logger/services/context.service';
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DrizzleError } from 'drizzle-orm';
import { Response } from 'express';

interface ExceptionContext {
  status: HttpStatus;
  exception: HttpException;
  detail?: string;
}

/**
 * Exception filter to handle Drizzle database errors and convert them to appropriate HTTP responses
 */
@Injectable()
@Catch(DrizzleError)
export class DrizzleExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService
  ) {}

  catch(exception: DrizzleError, host: ArgumentsHost): void {
    this.contextService.updateContext({
      context: this.contextService.getContext().context || 'DrizzleExceptionFilter.catch',
    });

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let exceptionCtx: ExceptionContext = {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      exception: new InternalServerErrorException('Database error occurred'),
    };

    // Check if it's a Postgres error
    const pgError = exception.cause as { code?: string; detail?: string } | undefined;
    if (pgError?.code) {
      exceptionCtx = this.handlePostgresError(pgError);
    } else {
      exceptionCtx = {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        exception: new InternalServerErrorException('Database error occurred'),
      };
    }

    const responseBody = exceptionCtx.exception.getResponse();
    this.logger.error('Database error occurred', {
      error: exception,
      status: exceptionCtx.status,
      detail: exceptionCtx.detail,
      responseBody: responseBody,
    });
    response.status(exceptionCtx.status).json(responseBody);
  }

  private handlePostgresError(error: { code?: string; detail?: string }): ExceptionContext {
    const errorCode = error?.code;

    switch (errorCode) {
      case '23505': // Unique constraint violation
        return {
          status: HttpStatus.CONFLICT,
          exception: new ConflictException('A record with the provided data already exists'),
          detail: error?.detail,
        };
      case '23503': // Foreign key constraint violation
        return {
          status: HttpStatus.BAD_REQUEST,
          exception: new BadRequestException('Invalid reference to related entity'),
          detail: error?.detail,
        };
      case '23502': // Not null constraint violation
        return {
          status: HttpStatus.BAD_REQUEST,
          exception: new BadRequestException('Required field cannot be empty'),
          detail: error?.detail,
        };
      case '23514': // Check constraint violation
        return {
          status: HttpStatus.BAD_REQUEST,
          exception: new BadRequestException('Data does not meet validation requirements'),
          detail: error?.detail,
        };
      case '42P01': // Undefined table
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          exception: new InternalServerErrorException('Database configuration error'),
          detail: error?.detail,
        };
      case '42703': // Undefined column
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          exception: new InternalServerErrorException('Database schema error'),
          detail: error?.detail,
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          exception: new InternalServerErrorException('Database operation failed'),
          detail: error?.detail,
        };
    }
  }
}
