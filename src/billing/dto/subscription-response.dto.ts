import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus } from '../enum/subscription-status.enum';

export class SubscriptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: SubscriptionStatus })
  status!: SubscriptionStatus;

  @ApiPropertyOptional()
  stripeSubscriptionId!: string | null;

  @ApiPropertyOptional()
  stripePriceId!: string | null;

  @ApiPropertyOptional()
  currentPeriodStart!: Date | null;

  @ApiPropertyOptional()
  currentPeriodEnd!: Date | null;

  @ApiProperty()
  cancelAtPeriodEnd!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
