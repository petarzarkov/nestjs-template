import { PasswordDecorator } from '@/core/decorators/password.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RegisterWithInviteDto {
  @PasswordDecorator()
  password!: string;

  @ApiProperty({
    description: 'A valid invitation token.',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsString()
  invitationToken!: string;
}
