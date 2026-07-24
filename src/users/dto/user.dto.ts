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
    name: z.string().optional(),
    image: z.string().nullable().optional(),
    role: z.enum(UserRole).optional(),
    banned: z.boolean().optional(),
  }),
) {}

export const getUsersQuerySchema = pageOptionsSchema.extend({
  banned: z.stringbool().optional(),
});

export class GetUsersQueryDto extends createZodDto(getUsersQuerySchema) {}
