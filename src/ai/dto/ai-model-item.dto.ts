import { ApiProperty } from '@nestjs/swagger';
import { AIProvider } from '../enum/ai-provider.enum';

export class AIModelItemDto {
  @ApiProperty({
    description: 'The provider of the model',
    enum: Object.values(AIProvider),
  })
  provider!: AIProvider;

  @ApiProperty({
    type: [String],
    description: 'The list of models from the provider',
  })
  models!: string[];
}
