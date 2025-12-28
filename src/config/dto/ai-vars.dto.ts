import { IsNumber, IsOptional, IsString } from 'class-validator';
import { AIProvider } from '@/ai/enum/ai-provider.enum';

export class AIVars {
  @IsString()
  @IsOptional()
  AI_GEMINI_API_KEY?: string;

  @IsString()
  @IsOptional()
  AI_GROQ_API_KEY?: string;

  @IsString()
  @IsOptional()
  AI_OPENROUTER_API_KEY?: string;

  @IsNumber()
  @IsOptional()
  AI_STREAM_TIMEOUT: number = 10000;

  @IsNumber()
  @IsOptional()
  AI_DEFAULT_TEMPERATURE: number = 0.8;
}

export const getAIConfig = (config: AIVars) => {
  return {
    streamTimeout: config.AI_STREAM_TIMEOUT,
    defaults: {
      temperature: config.AI_DEFAULT_TEMPERATURE,
    },
    providers: {
      ...(config.AI_GEMINI_API_KEY && {
        [AIProvider.GOOGLE]: {
          url: `https://generativelanguage.googleapis.com/v1beta/models`,
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
