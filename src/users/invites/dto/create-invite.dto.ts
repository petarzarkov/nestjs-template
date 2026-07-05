import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { emailSchema } from '@/core/zod/schemas';
import { UserRole } from '@/users/enum/user-role.enum';

export const createInviteSchema = z
  .object({
    email: emailSchema,
    role: z.enum(UserRole).describe('The role to assign to the invited user'),
  })
  .meta({ id: 'CreateInvite' });

export class CreateInviteDto extends createZodDto(createInviteSchema) {}
