import { ContextLogger } from '@/logger/services/context-logger.service';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { RedisContext } from '@nestjs/microservices';
import { Observable, tap } from 'rxjs';

/**
 * Global interceptor for logging all Redis pub/sub event handlers.
 * Logs event receipt and completion with timing.
 */
@Injectable()
export class EventLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: ContextLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const rpcContext = context.switchToRpc();
    const data = rpcContext.getData();
    const redisCtx = rpcContext.getContext<RedisContext>();

    const channel = redisCtx?.getChannel?.() || 'unknown';
    const eventId = data?.eventId || 'unknown';
    const eventType = data?.eventType || channel;
    const startTime = Date.now();

    this.logger.log(`Event received: ${eventType}`, {
      channel,
      eventId,
      eventType,
      requestId: data?.requestId,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(`Event handled: ${eventType}`, {
            channel,
            eventId,
            eventType,
            durationMs: duration,
          });
        },
        error: error => {
          const duration = Date.now() - startTime;
          this.logger.error(`Event handler failed: ${eventType}`, {
            channel,
            eventId,
            eventType,
            durationMs: duration,
            error,
          });
        },
      }),
    );
  }
}
