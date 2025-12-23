import { IsEmailDecorator } from '@/core/decorators/email.decorator';
import { UserRole } from '@/users/enum/user-role.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class CreateInviteDto {
  @IsEmailDecorator()
  email!: string;

  @ApiProperty({
    description: 'The role to assign to the invited user',
    enum: UserRole,
  })
  @IsEnum(UserRole)
  role!: UserRole;
}
