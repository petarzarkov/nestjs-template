import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiJwtAuth } from '@/core/decorators/api-jwt-auth.decorator';
import { Roles } from '@/core/decorators/roles.decorator';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { PaginatedDto } from '@/core/pagination/dto/paginated.dto';
import { UserRole } from '@/users/enum/user-role.enum';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditLog } from './entity/audit-log.entity';
import { AuditService } from './services/audit.service';

@ApiTags('audit')
@ApiJwtAuth()
@Roles(UserRole.ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get audit log entries (admin only)' })
  @ApiOkResponse({
    description: 'A paginated list of audit log entries.',
    type: PaginatedDto(AuditLog),
  })
  async getAuditLogs(
    @Query() queryDto: AuditLogQueryDto,
  ): Promise<PageDto<AuditLog>> {
    return this.auditService.getAuditLogs(queryDto);
  }
}
