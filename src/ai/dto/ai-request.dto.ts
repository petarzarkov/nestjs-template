import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { STRING_LENGTH } from '@/constants';
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
  @MaxLength(STRING_LENGTH.MODEL_NAME_MAX)
  @ApiProperty({
    description: 'The model to use',
    example: 'gemini-2.5-flash',
    maxLength: STRING_LENGTH.MODEL_NAME_MAX,
  })
  model!: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(STRING_LENGTH.TEXT_MAX)
  @ApiProperty({
    description: 'The system prompt to send to the AI provider',
    example:
      'You are a helpful assistant that can answer questions and help with tasks.',
    maxLength: STRING_LENGTH.TEXT_MAX,
  })
  systemPrompt?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(STRING_LENGTH.TEXT_MAX)
  @ApiProperty({
    description: 'The prompt to send to the AI provider',
    example: 'Write a short story about a cat.',
    maxLength: STRING_LENGTH.TEXT_MAX,
  })
  prompt!: string;
}
