import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { InviteStatus } from '../enum/invite-status.enum';

export class ListInvitesQueryDto {
  @ApiPropertyOptional({ enum: InviteStatus, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(InviteStatus, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @Type(() => String)
  statuses?: InviteStatus[];
}
