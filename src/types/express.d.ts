import type { SanitizedUser } from '@/users/entity/user.entity';

/**
 * Better Auth (`@thallesp/nestjs-better-auth`) attaches the authenticated user
 * to `request.user` after the global `AuthGuard` runs. The session-user object
 * is structurally identical to our {@link SanitizedUser}, so we type it as such
 * — one user type flows through HTTP (`@CurrentUser`), guards and the WS gateway.
 */
declare global {
  namespace Express {
    interface Request {
      user?: SanitizedUser | null;
    }
  }
}

export {};
