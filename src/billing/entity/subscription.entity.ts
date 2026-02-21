import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { STRING_LENGTH } from '@/constants';
import { Auditable } from '@/core/decorators/auditable.decorator';
import { User } from '@/users/entity/user.entity';
import { SubscriptionStatus } from '../enum/subscription-status.enum';

@Auditable()
@Entity('subscription')
@Index('subscription_user_id_index', ['userId'])
@Index('subscription_stripe_customer_id_index', ['stripeCustomerId'])
@Index('subscription_stripe_subscription_id_index', ['stripeSubscriptionId'], {
  unique: true,
  where: '"stripe_subscription_id" IS NOT NULL',
})
export class Subscription {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_subscription',
  })
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: STRING_LENGTH.SHORT_MAX })
  stripeCustomerId!: string;

  @ApiPropertyOptional()
  @Column({
    type: 'varchar',
    length: STRING_LENGTH.SHORT_MAX,
    nullable: true,
  })
  stripeSubscriptionId!: string | null;

  @ApiPropertyOptional()
  @Column({
    type: 'varchar',
    length: STRING_LENGTH.SHORT_MAX,
    nullable: true,
  })
  stripePriceId!: string | null;

  @ApiProperty({ enum: SubscriptionStatus })
  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    enumName: 'subscription_status_enum',
    default: SubscriptionStatus.INCOMPLETE,
  })
  status!: SubscriptionStatus;

  @ApiPropertyOptional()
  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodStart!: Date | null;

  @ApiPropertyOptional()
  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodEnd!: Date | null;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_subscription_to_user',
  })
  user!: User;
}
