import { Injectable } from '@nestjs/common';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { AuditLog } from '../entity/audit-log.entity';
import { AuditLogRepository } from '../repos/audit-log.repository';

@Injectable()
export class AuditService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async getAuditLogs(queryDto: AuditLogQueryDto): Promise<PageDto<AuditLog>> {
    return this.auditLogRepository.findPaginated(queryDto);
  }
}
