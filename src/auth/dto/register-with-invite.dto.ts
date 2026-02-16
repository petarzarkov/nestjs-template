import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { STRING_LENGTH } from '@/constants';
import { PasswordDecorator } from '@/core/decorators/password.decorator';

export class RegisterWithInviteDto {
  @PasswordDecorator()
  password!: string;

  @ApiProperty({
    description: 'A valid invitation token.',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    maxLength: STRING_LENGTH.SHORT_MAX,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(STRING_LENGTH.SHORT_MAX)
  invitationToken!: string;
}
