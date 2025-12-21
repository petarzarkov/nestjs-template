import { ContextLogger } from '@/logger/services/context-logger.service';
import { ContextService } from '@/logger/services/context.service';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const resp = httpContext.getResponse<Response>();
    const instance = context.getClass();
    const handler = context.getHandler();

    this.contextService.updateContext({
      context: `${instance.name}.${handler.name}`,
      flow: 'http',
    });

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        this.logger.log('Sent Response', {
          statusCode: resp.statusCode,
          responseBody: responseBody,
          elapsed: Date.now() - resp.locals.startTime,
        });
      }),
      catchError((err: Error & { status?: number; response?: unknown }) => {
        const errorResponse = {
          statusCode: err?.status || resp.statusCode,
          name: err?.name,
          message: err?.message,
          responseBody: err?.response || err.response,
        };

        this.logger.error('Propagating Error Response', {
          errorResponse,
        });

        throw err;
      })
    );
  }
}
