import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../enum/user-role.enum';

/**
 * User response/row shape. Request validation lives in Zod DTOs
 * (`@/users/dto/user.dto`); this class carries the Swagger metadata and is
 * structurally compatible with a selected drizzle row. Credentials live in the
 * Better Auth `account` table, so there is nothing secret to strip here.
 */
export class User {
  @ApiProperty({ description: 'user ID' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty({ description: 'Better Auth display name' })
  name!: string;

  @ApiProperty({ nullable: true })
  image!: string | null;

  @ApiProperty({ enum: Object.values(UserRole) })
  role!: UserRole;

  @ApiProperty()
  banned!: boolean;

  @ApiProperty({ nullable: true })
  banReason!: string | null;

  @ApiProperty({ nullable: true })
  banExpires!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

/**
 * The `user` row has no secret columns (password lives in `account`), so this
 * is structurally identical to {@link User}. Kept as a distinct type so the
 * many `SanitizedUser` references across the app remain valid.
 */
export class SanitizedUser extends User {}

/** No-op passthrough (kept for API compatibility — nothing to strip). */
export const sanitizeUser = (user: User): SanitizedUser => user;
