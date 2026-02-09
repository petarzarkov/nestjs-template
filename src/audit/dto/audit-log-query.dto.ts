import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
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
  })
  @IsString()
  @IsOptional()
  entityName?: string;

  @ApiPropertyOptional({ description: 'Filter by entity ID' })
  @IsString()
  @IsOptional()
  entityId?: string;
}
