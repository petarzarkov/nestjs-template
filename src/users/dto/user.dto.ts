import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { pageOptionsSchema } from '@/core/pagination/dto/page-options.dto';
import { emailSchema } from '@/core/zod/schemas';
import { UserRole } from '../enum/user-role.enum';

/**
 * Editable user fields (admin PATCH). Password is intentionally excluded —
 * passwords are set via the auth flows (hashed), not raw here.
 */
export class UpdateUserDto extends createZodDto(
  z.object({
    email: emailSchema.optional(),
    displayName: z.string().nullable().optional(),
    picture: z.string().nullable().optional(),
    roles: z.array(z.enum(UserRole)).optional(),
    suspended: z.boolean().optional(),
  }),
) {}

export const getUsersQuerySchema = pageOptionsSchema.extend({
  suspended: z.stringbool().optional(),
});

export class GetUsersQueryDto extends createZodDto(getUsersQuerySchema) {}
