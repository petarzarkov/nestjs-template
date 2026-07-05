import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const authResponseSchema = z
  .object({ accessToken: z.string().describe('jwt token') })
  .meta({ id: 'AuthResponse' });

export class AuthResponseDto extends createZodDto(authResponseSchema) {}
