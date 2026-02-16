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
import { STRING_LENGTH } from '@/constants';
import { User } from '@/users/entity/user.entity';
import { OAuthProvider } from '../enum/oauth-provider.enum';

@Entity('auth_providers')
@Index('provider_auth_provider_id_index', ['provider', 'authProviderId'], {
  unique: true,
  where: '"auth_provider_id" IS NOT NULL',
})
@Index('user_provider_index', ['userId', 'provider'], { unique: true })
export class AuthProvider {
  @ApiProperty({
    description: 'Auth provider ID',
  })
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_auth_provider',
  })
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
  @Column({
    type: 'enum',
    enum: OAuthProvider,
    enumName: 'oauth_provider_enum',
  })
  provider!: OAuthProvider;

  @ApiProperty({
    description: 'Provider-specific user ID (null for local auth)',
    nullable: true,
  })
  @Column({
    type: 'varchar',
    nullable: true,
    length: STRING_LENGTH.PASSWORD_HASH_MAX,
  })
  authProviderId!: string | null;

  @Column({
    type: 'varchar',
    nullable: true,
    select: false,
    length: STRING_LENGTH.PASSWORD_HASH_MAX,
  })
  passwordHash!: string | null;

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
    foreignKeyConstraintName: 'FK_auth_provider_to_user',
  })
  user!: User;
}
