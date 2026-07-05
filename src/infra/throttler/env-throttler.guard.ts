import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException } from '@nestjs/throttler';
import { AppEnv } from '@/config/enum/app-env.enum';
import { AppConfigService } from '@/config/services/app.config.service';
import {
  ENV_THROTTLE_KEY,
  type EnvThrottleConfig,
} from '@/core/decorators/env-throttle.decorator';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Environment-aware rate limiter backed by an in-process sliding window
 * (single-node; no Redis). Driven by the `@EnvThrottle()` decorator.
 */
@Injectable()
export class EnvThrottlerGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly env: AppEnv;

  constructor(
    private readonly reflector: Reflector,
    configService: AppConfigService,
  ) {
    this.env = configService.getOrThrow('app').env;
  }

  canActivate(context: ExecutionContext): boolean {
    const config = this.reflector.getAllAndOverride<EnvThrottleConfig>(
      ENV_THROTTLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!config) {
      return true;
    }

    const ttl = config[this.env] ?? 0;
    if (!ttl) {
      return true;
    }
    const limit = config.limit ?? 1;

    const request = context.switchToHttp().getRequest<{
      ip?: string;
      user?: { id?: string };
      route?: { path?: string };
    }>();
    const key = `${request.route?.path ?? ''}:${request.user?.id ?? request.ip ?? 'anon'}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + ttl });
      return true;
    }
    if (bucket.count >= limit) {
      throw new ThrottlerException();
    }
    bucket.count++;
    return true;
  }
}
