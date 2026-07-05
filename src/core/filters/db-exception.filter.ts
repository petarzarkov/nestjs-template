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
import { SQLiteError } from 'bun:sqlite';
import { Response } from 'express';
import { ContextLogger, ContextService } from '@arkv/nestjs-context-logger';

interface ExceptionContext {
  status: HttpStatus;
  exception: HttpException;
}

/**
 * Converts raw SQLite (bun:sqlite) errors into appropriate HTTP responses.
 */
@Injectable()
@Catch(SQLiteError)
export class DbExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
  ) {}

  catch(exception: SQLiteError, host: ArgumentsHost): void {
    this.contextService.updateContext({
      context:
        this.contextService.getContext().context || 'DbExceptionFilter.catch',
    });

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const { status, exception: httpException } = this.map(exception);

    const responseBody = httpException.getResponse();
    this.logger.error('Database error occurred', {
      error: exception,
      status,
      code: exception.code,
      responseBody,
    });
    response.status(status).json(responseBody);
  }

  private map(exception: SQLiteError): ExceptionContext {
    const code = exception.code ?? '';

    if (
      code.startsWith('SQLITE_CONSTRAINT_UNIQUE') ||
      code.startsWith('SQLITE_CONSTRAINT_PRIMARYKEY')
    ) {
      return {
        status: HttpStatus.CONFLICT,
        exception: new ConflictException(
          'A record with the provided data already exists',
        ),
      };
    }
    if (code.startsWith('SQLITE_CONSTRAINT_FOREIGNKEY')) {
      return {
        status: HttpStatus.BAD_REQUEST,
        exception: new BadRequestException(
          'Invalid reference to related entity',
        ),
      };
    }
    if (code.startsWith('SQLITE_CONSTRAINT_NOTNULL')) {
      return {
        status: HttpStatus.BAD_REQUEST,
        exception: new BadRequestException('Required field cannot be empty'),
      };
    }
    if (code.startsWith('SQLITE_CONSTRAINT')) {
      return {
        status: HttpStatus.BAD_REQUEST,
        exception: new BadRequestException(
          'Data does not meet validation requirements',
        ),
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      exception: new InternalServerErrorException('Database operation failed'),
    };
  }
}
