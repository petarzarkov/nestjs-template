import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request } from 'express';
import Redis from 'ioredis';
import { AppEnv } from '@/config/enum/app-env.enum';
import { AppConfigService } from '@/config/services/app.config.service';
import {
  ENV_THROTTLE_KEY,
  EnvThrottleConfig,
} from '@/core/decorators/env-throttle.decorator';
import { RedisService } from '../services/redis.service';

@Injectable()
export class EnvThrottlerGuard implements CanActivate {
  private readonly appEnv: AppEnv;
  private readonly redis: Redis;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: AppConfigService,
    private readonly redisService: RedisService,
  ) {
    this.appEnv = this.configService.get('app.env');
    this.redis = this.redisService.newConnection('env-throttler', { db: 2 });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.getAllAndOverride<EnvThrottleConfig>(
      ENV_THROTTLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!config) {
      return true;
    }

    const ttlMs = config[this.appEnv];
    if (!ttlMs || ttlMs <= 0) {
      return true;
    }

    const limit = config.limit ?? 1;
    const request = context.switchToHttp().getRequest<Request>();
    const key = this.generateKey(context, request);

    // LUA SCRIPT: Atomic increment and expire
    // 1. Increment the key
    // 2. If the value is 1 (new key) OR the TTL is -1 (zombie key with no expiry), set the PEXPIRE
    const script = `
      local total = redis.call('INCR', KEYS[1])
      if total == 1 or redis.call('PTTL', KEYS[1]) == -1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
      end
      return total
    `;
    // Execute script atomically
    // args: script, number of keys (1), key, ttlMs
    const totalHits = (await this.redis.eval(script, 1, key, ttlMs)) as number;

    if (totalHits > limit) {
      // Get remaining TTL in milliseconds
      const pttl = await this.redis.pttl(key);
      const timeToExpire = pttl > 0 ? pttl : ttlMs;

      throw new ThrottlerException(
        `Too many requests. Please try again in ${this.formatDuration(timeToExpire)}.`,
      );
    }

    return true;
  }

  private generateKey(context: ExecutionContext, request: Request): string {
    const userId = request.user?.id ?? 'anonymous';
    const handler = context.getHandler().name;
    const controller = context.getClass().name;
    return `env-throttle:${controller}:${handler}:${userId}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    const hours = Math.ceil(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
}
