import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PageOptionsDto } from '@/core/pagination/dto/page-options.dto';
import { User } from '../entity/user.entity';

export class CreateUserDto extends OmitType(User, [
  'id',
  'createdAt',
  'updatedAt',
] as const) {}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class GetUsersQueryDto extends PageOptionsDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  @Transform(({ obj }) => {
    return obj.suspended && obj.suspended === 'true';
  })
  suspended?: boolean;
}

export class UserDto extends OmitType(User, ['password'] as const) {}
