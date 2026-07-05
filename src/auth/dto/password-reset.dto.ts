import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { emailSchema, passwordSchema } from '@/core/zod/schemas';

export const requestPasswordResetSchema = z
  .object({ email: emailSchema })
  .meta({ id: 'RequestPasswordReset' });

export class RequestPasswordResetDto extends createZodDto(
  requestPasswordResetSchema,
) {}

export const passwordResetSchema = z
  .object({
    resetToken: z
      .string()
      .length(64, 'Reset token must be exactly 64 characters')
      .regex(/^[a-f0-9]+$/i, 'Reset token must be a hex string'),
    newPassword: passwordSchema,
  })
  .meta({ id: 'PasswordReset' });

export class PasswordResetDto extends createZodDto(passwordResetSchema) {}
