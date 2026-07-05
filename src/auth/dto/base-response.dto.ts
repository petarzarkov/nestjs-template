import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const baseResponseSchema = z
  .object({ message: z.string() })
  .meta({ id: 'BaseResponse' });

export class BaseResponseDto extends createZodDto(baseResponseSchema) {}
