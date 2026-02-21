import { ApiProperty } from '@nestjs/swagger';

export class CheckoutSessionResponseDto {
  @ApiProperty({ description: 'Stripe Checkout Session URL to redirect to' })
  url!: string;
}
