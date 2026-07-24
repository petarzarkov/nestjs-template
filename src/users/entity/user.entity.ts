import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { withDateFormat } from '@/core/zod/entity-schema';
import { users } from '../schema/user.schema';
import { UserRole } from '../enum/user-role.enum';

/**
 * User response/row shape — the single source of truth, derived from the
 * Drizzle `user` table (`role` refined to the enum). Credentials live in the
 * Better Auth `account` table, so there is nothing secret to strip here.
 */
export const userSelectSchema = withDateFormat(
  createSelectSchema(users, { role: z.enum(UserRole) }),
);

export class User extends createZodDto(userSelectSchema) {}

/**
 * The `user` row has no secret columns, so the sanitized shape is identical to
 * {@link User}. Kept as a (structurally identical) subclass so the many
 * `SanitizedUser` references stay valid as both a type and a value, and Better
 * Auth's session user stays assignable to it.
 */
export class SanitizedUser extends User {}

/** No-op passthrough (kept for API compatibility — nothing to strip). */
export const sanitizeUser = (user: User): SanitizedUser => user;
