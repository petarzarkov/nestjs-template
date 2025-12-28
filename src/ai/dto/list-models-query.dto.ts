import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AIProvider } from '../enum/ai-provider.enum';

export class ListModelsQueryDto {
  @ApiProperty({
    enum: Object.values(AIProvider),
    description: 'The AI provider to list models for',
    example: AIProvider.GOOGLE,
  })
  @IsEnum(AIProvider)
  provider!: AIProvider;
}
