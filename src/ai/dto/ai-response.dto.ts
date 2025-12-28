import { ApiProperty } from '@nestjs/swagger';
import { AIProvider } from '../enum/ai-provider.enum';

export class AIResponseDto {
  @ApiProperty({
    description: 'The model used to generate the response',
  })
  model!: string;

  @ApiProperty({
    description: 'The provider used to generate the response',
    enum: Object.values(AIProvider),
  })
  provider!: AIProvider;

  @ApiProperty({
    description: 'The text of the response',
  })
  text!: string;
}
