import type { SanitizedUser } from '@/users/entity/user.entity';

/**
 * Ambient Express augmentations for this app.
 *
 * `Request.user`: Better Auth (`@thallesp/nestjs-better-auth`) attaches the
 * authenticated user to `request.user` after the global `AuthGuard` runs. The
 * session-user object is structurally identical to our {@link SanitizedUser}, so
 * we type it as such — one user type flows through HTTP (`@CurrentUser`), guards
 * and the WS gateway.
 *
 * `Locals.startTime`: set by `RequestMiddleware` and read by
 * `HttpLoggingInterceptor` to compute per-request elapsed time.
 */
declare global {
  namespace Express {
    interface Request {
      user?: SanitizedUser | null;
    }
    interface Locals {
      startTime: number;
    }
  }
}
