import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { STRING_LENGTH } from '@/constants';
import { PageOptionsDto } from '@/core/pagination/dto/page-options.dto';
import { AuditAction } from '../enum/audit-action.enum';

export class AuditLogQueryDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: 'Filter by actor user ID' })
  @IsUUID('4')
  @IsOptional()
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action type',
    enum: AuditAction,
  })
  @IsEnum(AuditAction)
  @IsOptional()
  action?: AuditAction;

  @ApiPropertyOptional({
    description: 'Filter by entity name (e.g., "User")',
    maxLength: STRING_LENGTH.MEDIUM_MAX,
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(STRING_LENGTH.MEDIUM_MAX)
  entityName?: string;

  @ApiPropertyOptional({
    description: 'Filter by entity ID',
    maxLength: STRING_LENGTH.SHORT_MAX,
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(STRING_LENGTH.SHORT_MAX)
  entityId?: string;
}
