import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { pageOptionsSchema } from '@/core/pagination/dto/page-options.dto';
import { emailSchema } from '@/core/zod/schemas';
import { userSelectSchema } from '../entity/user.entity';

/**
 * Editable user fields (admin PATCH), derived from the user row schema so the
 * field set stays in sync. `email` is overridden with the stricter validation
 * schema, and every field is optional. Credentials are set via the auth flows
 * (hashed), never here.
 */
export class UpdateUserDto extends createZodDto(
  userSelectSchema
    .pick({ name: true, image: true, role: true, banned: true })
    .extend({ email: emailSchema })
    .partial(),
) {}

export const getUsersQuerySchema = pageOptionsSchema.extend({
  banned: z.stringbool().optional(),
});

export class GetUsersQueryDto extends createZodDto(getUsersQuerySchema) {}
