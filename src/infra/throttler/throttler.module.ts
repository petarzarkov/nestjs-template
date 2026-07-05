import { ExecutionContext, Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SECOND } from '@/constants';
import { EnvThrottlerGuard } from './env-throttler.guard';

/**
 * In-memory rate limiting (no Redis / single-node). Global tiers + the
 * per-route {@link EnvThrottlerGuard}. Authenticated requests are exempt from
 * the global tiers.
 */
@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1 * SECOND, limit: 10 },
        { name: 'medium', ttl: 10 * SECOND, limit: 50 },
        { name: 'long', ttl: 60 * SECOND, limit: 300 },
      ],
      skipIf: (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest<{ user?: unknown }>();
        return !!request.user;
      },
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    EnvThrottlerGuard,
  ],
  exports: [ThrottlerModule, EnvThrottlerGuard],
})
export class RateLimitModule {}
