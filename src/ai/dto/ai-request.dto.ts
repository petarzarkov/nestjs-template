import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AIProvider } from '../enum/ai-provider.enum';

export class AIRequestDto {
  @IsEnum(AIProvider)
  @ApiProperty({
    enum: Object.values(AIProvider),
    description: 'The AI provider to use',
    example: AIProvider.GOOGLE,
  })
  provider!: AIProvider;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The model to use',
    example: 'gemini-2.5-flash',
  })
  model!: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'The system prompt to send to the AI provider',
    example:
      'You are a helpful assistant that can answer questions and help with tasks.',
  })
  systemPrompt?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The prompt to send to the AI provider',
    example: 'Write a short story about a cat.',
  })
  prompt!: string;
}
