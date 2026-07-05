import { ApiProperty, OmitType } from '@nestjs/swagger';
import { UserRole } from '../enum/user-role.enum';

/**
 * User response/row shape. Request validation lives in Zod DTOs
 * (`@/users/dto/user.dto`); this class carries the Swagger metadata and is
 * structurally compatible with a selected drizzle row.
 */
export class User {
  @ApiProperty({ description: 'user ID' })
  id!: string;

  @ApiProperty()
  email!: string;

  // Not exposed via Swagger (secret); stripped by sanitizeUser.
  password!: string | null;

  @ApiProperty({ nullable: true })
  displayName!: string | null;

  @ApiProperty({ nullable: true })
  picture!: string | null;

  @ApiProperty({ enum: Object.values(UserRole), isArray: true })
  roles!: UserRole[];

  @ApiProperty()
  suspended!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class SanitizedUser extends OmitType(User, ['password'] as const) {}

/** Strip the password hash from a user row. */
export const sanitizeUser = (user: User): SanitizedUser => {
  const { password: _password, ...sanitized } = user;
  return sanitized;
};
