import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Length, Matches } from 'class-validator';
import { IsEmailDecorator } from '@/core/decorators/email.decorator';
import { PasswordDecorator } from '@/core/decorators/password.decorator';

export class RequestPasswordResetDto {
  @IsEmailDecorator()
  email!: string;
}

export class PasswordResetDto {
  @ApiProperty()
  @IsNotEmpty()
  @Matches(/^[a-f0-9]+$/i, { message: 'Reset token must be a hex string' })
  @Length(64, 64, { message: 'Reset token must be exactly 64 characters' })
  resetToken!: string;

  @PasswordDecorator()
  newPassword!: string;
}
