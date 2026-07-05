import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { emailSchema, passwordSchema } from '@/core/zod/schemas';

export const loginRequestSchema = z
  .object({ email: emailSchema, password: passwordSchema })
  .meta({ id: 'LoginRequest' });

export class LoginRequestDto extends createZodDto(loginRequestSchema) {}
