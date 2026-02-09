import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsUUID } from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IsUniqueEnumArrayDecorator } from '@/core/decorators/is-unique-enum.decorator';
import { PasswordDecorator } from '@/core/decorators/password.decorator';
import { UserRole } from '../enum/user-role.enum';

@Entity()
export class User {
  @ApiProperty({
    description: 'user ID',
  })
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4')
  id!: string;

  @ApiProperty()
  @Column({ unique: true })
  @IsEmail()
  email!: string;

  @Column({ select: false, nullable: true })
  @PasswordDecorator(true)
  password!: string | null;

  @ApiProperty({
    description: 'Display name (from OAuth providers)',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  @IsOptional()
  displayName!: string | null;

  @ApiProperty({
    description: 'Profile picture URL (from OAuth providers)',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  @IsOptional()
  picture!: string | null;

  @Column({
    type: 'enum',
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
