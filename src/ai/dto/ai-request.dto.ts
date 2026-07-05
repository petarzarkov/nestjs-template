import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { STRING_LENGTH } from '@/constants';
import { AIProvider } from '../enum/ai-provider.enum';

export const aiRequestSchema = z
  .object({
    provider: z.enum(AIProvider).describe('The AI provider to use'),
    model: z
      .string()
      .min(1)
      .max(STRING_LENGTH.MODEL_NAME_MAX)
      .describe('The model to use'),
    systemPrompt: z
      .string()
      .min(1)
      .max(STRING_LENGTH.TEXT_MAX)
      .optional()
      .describe('The system prompt to send to the AI provider'),
    prompt: z
      .string()
      .min(1)
      .max(STRING_LENGTH.TEXT_MAX)
      .describe('The prompt to send to the AI provider'),
  })
  .meta({ id: 'AIRequest' });

export class AIRequestDto extends createZodDto(aiRequestSchema) {}
