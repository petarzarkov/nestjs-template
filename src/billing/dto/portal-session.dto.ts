import { ApiProperty } from '@nestjs/swagger';

export class PortalSessionResponseDto {
  @ApiProperty({ description: 'Stripe Customer Portal URL to redirect to' })
  url!: string;
}
