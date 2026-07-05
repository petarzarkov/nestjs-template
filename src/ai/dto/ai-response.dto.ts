import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AIProvider } from '../enum/ai-provider.enum';

export const aiResponseSchema = z
  .object({
    model: z.string().describe('The model used to generate the response'),
    provider: z
      .enum(AIProvider)
      .describe('The provider used to generate the response'),
    text: z.string().describe('The text of the response'),
  })
  .meta({ id: 'AIResponse' });

export class AIResponseDto extends createZodDto(aiResponseSchema) {}
