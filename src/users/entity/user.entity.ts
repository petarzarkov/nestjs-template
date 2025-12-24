import { IsUniqueEnumArrayDecorator } from '@/core/decorators/is-unique-enum.decorator';
import { PasswordDecorator } from '@/core/decorators/password.decorator';
import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsUUID } from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
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

  @Column({ select: false })
  @PasswordDecorator()
  password!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    array: true,
  })
  @ApiProperty({
    enum: UserRole,
    isArray: true,
  })
  @IsUniqueEnumArrayDecorator(UserRole)
  roles!: UserRole[];

  @ApiProperty()
  @Column({ default: false })
  @IsBoolean()
  suspended!: boolean;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

export class SanitizedUser extends OmitType(User, ['password'] as const) {}
