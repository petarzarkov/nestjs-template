import { ApiProperty } from '@nestjs/swagger';
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
import { User } from '@/users/entity/user.entity';
import { OAuthProvider } from '../enum/oauth-provider.enum';

@Entity('auth_providers')
@Index(['provider', 'authProviderId'], {
  unique: true,
  where: '"auth_provider_id" IS NOT NULL',
})
@Index(['userId', 'provider'], { unique: true })
export class AuthProvider {
  @ApiProperty({
    description: 'Auth provider ID',
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: 'User ID',
  })
  @Column({ type: 'uuid' })
  userId!: string;

  @ApiProperty({
    description: 'OAuth provider name',
    enum: Object.values(OAuthProvider),
  })
  @Column({ type: 'enum', enum: OAuthProvider })
  provider!: OAuthProvider;

  @ApiProperty({
    description: 'Provider-specific user ID (null for local auth)',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  authProviderId!: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  passwordHash!: string | null;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
