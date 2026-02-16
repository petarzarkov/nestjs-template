import { IsBoolean, IsString, IsUUID } from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';
import { STRING_LENGTH } from '@/constants';
import { User } from './user.entity';

@Entity()
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_password_reset_token',
  })
  @IsUUID('4')
  id!: string;

  @ManyToOne(() => User)
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_password_reset_token_to_user',
  })
  user!: User;

  @RelationId((token: PasswordResetToken) => token.user)
  userId!: string;

  @Column({ length: STRING_LENGTH.SHORT_MAX })
  @IsString()
  token!: string;

  @Column({ default: false })
  @IsBoolean()
  used!: boolean;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
