import { Roles as BetterAuthRoles } from '@thallesp/nestjs-better-auth';
import type { UserRole } from '@/users/enum/user-role.enum';

/**
 * Require the authenticated user to have one of the given roles (checked
 * against `user.role` via the Better Auth admin plugin). Thin varargs wrapper
 * over the package's array-based `@Roles([...])` so existing
 * `@Roles(UserRole.ADMIN)` usages keep working.
 */
export const Roles = (...roles: UserRole[]) => BetterAuthRoles(roles);
