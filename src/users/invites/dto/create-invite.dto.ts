import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { IsEmailDecorator } from '@/core/decorators/email.decorator';
import { UserRole } from '@/users/enum/user-role.enum';

export class CreateInviteDto {
  @IsEmailDecorator()
  email!: string;

  @ApiProperty({
    description: 'The role to assign to the invited user',
    enum: Object.values(UserRole),
    example: UserRole.USER,
  })
  @IsEnum(UserRole)
  role!: UserRole;
}
