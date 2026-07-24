import { z } from 'zod';
import { AIProvider } from '@/ai/enum/ai-provider.enum';

export const aiVarsSchema = z.object({
  AI_GEMINI_API_KEY: z.string().optional(),
  AI_GROQ_API_KEY: z.string().optional(),
  AI_OPENROUTER_API_KEY: z.string().optional(),
  AI_STREAM_TIMEOUT: z.coerce.number().default(10000),
  AI_DEFAULT_TEMPERATURE: z.coerce.number().default(0.8),
});

export type AIVars = z.infer<typeof aiVarsSchema>;

export const getAIConfig = (config: AIVars) => {
  return {
    streamTimeout: config.AI_STREAM_TIMEOUT,
    defaults: {
      temperature: config.AI_DEFAULT_TEMPERATURE,
    },
    providers: {
      ...(config.AI_GEMINI_API_KEY && {
        [AIProvider.GOOGLE]: {
          // Gemini's OpenAI-compatible base (chat/completions, models, SSE).
          url: `https://generativelanguage.googleapis.com/v1beta/openai`,
          apiKey: config.AI_GEMINI_API_KEY,
        },
      }),
      ...(config.AI_GROQ_API_KEY && {
        [AIProvider.GROQ]: {
          url: `https://api.groq.com/openai/v1`,
          apiKey: config.AI_GROQ_API_KEY,
        },
      }),
      ...(config.AI_OPENROUTER_API_KEY && {
        [AIProvider.OPENROUTER]: {
          url: `https://openrouter.ai/api/v1`,
          apiKey: config.AI_OPENROUTER_API_KEY,
        },
      }),
    },
  };
};
