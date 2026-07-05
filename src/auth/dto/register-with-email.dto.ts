import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { emailSchema, passwordSchema } from '@/core/zod/schemas';

export const registerWithEmailSchema = z
  .object({ email: emailSchema, password: passwordSchema })
  .meta({ id: 'RegisterWithEmailDto' });

export class RegisterWithEmailDto extends createZodDto(
  registerWithEmailSchema,
) {}
