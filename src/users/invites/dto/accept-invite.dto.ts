import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { passwordSchema } from '@/core/zod/schemas';

export const acceptInviteSchema = z
  .object({
    inviteCode: z.string().min(1).describe('The invite code from the email'),
    password: passwordSchema,
  })
  .meta({ id: 'AcceptInvite' });

export class AcceptInviteDto extends createZodDto(acceptInviteSchema) {}
