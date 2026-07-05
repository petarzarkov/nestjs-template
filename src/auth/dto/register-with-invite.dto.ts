import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { STRING_LENGTH } from '@/constants';
import { passwordSchema } from '@/core/zod/schemas';

export const registerWithInviteSchema = z
  .object({
    password: passwordSchema,
    invitationToken: z
      .string()
      .min(1)
      .max(STRING_LENGTH.SHORT_MAX)
      .describe('A valid invitation token.'),
  })
  .meta({ id: 'RegisterWithInviteDto' });

export class RegisterWithInviteDto extends createZodDto(
  registerWithInviteSchema,
) {}
