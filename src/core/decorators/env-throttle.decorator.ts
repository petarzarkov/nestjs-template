import { applyDecorators, SetMetadata } from '@nestjs/common';
import { AppEnv } from '@/config/enum/app-env.enum';
import { HOUR, MINUTE } from '@/constants';

export const ENV_THROTTLE_KEY = 'envThrottle';

export interface EnvThrottleConfig {
  /** TTL in milliseconds per environment. Use 0 or omit to skip throttling for that environment. */
  [AppEnv.LOCAL]?: number;
  [AppEnv.DEV]?: number;
  [AppEnv.STG]?: number;
  [AppEnv.PRD]?: number;
  /** Maximum number of requests within the TTL window. Defaults to 1. */
  limit?: number;
}

const DEFAULT_THROTTLE_CONFIG: EnvThrottleConfig = {
  [AppEnv.LOCAL]: 1 * MINUTE,
  [AppEnv.DEV]: 10 * MINUTE,
  [AppEnv.STG]: HOUR,
  [AppEnv.PRD]: HOUR,
  limit: 1,
};

/**
 * Decorator to apply environment-aware rate limiting.
 * Allows different throttle TTLs per environment.
 *
 * @example
 * ```ts
 * @EnvThrottle({
 *   [AppEnv.LOCAL]: 0,        // No throttling in local
 *   [AppEnv.DEV]: 10 * MINUTE, // 10 minutes in dev
 *   [AppEnv.STG]: HOUR,        // 1 hour in stage
 *   [AppEnv.PRD]: HOUR,        // 1 hour in prod
 *   limit: 1,                  // 1 request per TTL window
 * })
 * ```
 */
export const EnvThrottle = (config?: EnvThrottleConfig) => {
  const finalConfig = config ?? DEFAULT_THROTTLE_CONFIG;
  return applyDecorators(SetMetadata(ENV_THROTTLE_KEY, finalConfig));
};
