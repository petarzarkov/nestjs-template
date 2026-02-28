import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsUUID } from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { STRING_LENGTH } from '@/constants';
import { Auditable } from '@/core/decorators/auditable.decorator';
import { IsUniqueEnumArrayDecorator } from '@/core/decorators/is-unique-enum.decorator';
import { PasswordDecorator } from '@/core/decorators/password.decorator';
import { UserRole } from '../enum/user-role.enum';

@Auditable({ exclude: ['password'] })
@Entity()
@Unique('UQ_user_email', ['email'])
export class User {
  @ApiProperty({
    description: 'user ID',
  })
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_user',
  })
  @IsUUID('4')
  id!: string;

  @ApiProperty()
  @Column({ length: STRING_LENGTH.EMAIL_MAX })
  @IsEmail()
  email!: string;

  @Column({
    type: 'varchar',
    length: STRING_LENGTH.PASSWORD_HASH_MAX,
    select: false,
    nullable: true,
  })
  @PasswordDecorator(true)
  password!: string | null;

  @ApiProperty({
    description: 'Display name (from OAuth providers)',
    nullable: true,
  })
  @Column({
    type: 'varchar',
    nullable: true,
    length: 80,
  })
  @IsOptional()
  displayName!: string | null;

  @ApiProperty({
    description: 'Profile picture URL (from OAuth providers)',
    nullable: true,
  })
  @Column({ type: 'varchar', nullable: true, length: STRING_LENGTH.MEDIUM_MAX })
  @IsOptional()
  picture!: string | null;

  @Column({
    type: 'enum',
    enumName: 'user_role_enum',
    enum: UserRole,
    array: true,
  })
  @ApiProperty({
    enum: Object.values(UserRole),
    isArray: true,
    example: [UserRole.USER],
  })
  @IsUniqueEnumArrayDecorator(UserRole)
  roles!: UserRole[];

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  @IsBoolean()
  suspended!: boolean;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  static sanitize(user: User): SanitizedUser {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}

export class SanitizedUser extends OmitType(User, ['password'] as const) {}
