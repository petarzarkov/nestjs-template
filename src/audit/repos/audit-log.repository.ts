import { Inject, Injectable } from '@nestjs/common';
import { and, eq, type SQL } from 'drizzle-orm';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { PaginationFactory } from '@/core/pagination/pagination.factory';
import { DRIZZLE_DB, type DrizzleDB } from '@/infra/db/database.module';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { AuditLog } from '../entity/audit-log.entity';
import { auditLog } from '../schema/audit-log.schema';

@Injectable()
export class AuditLogRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly paginationFactory: PaginationFactory,
  ) {}

  findPaginated(queryDto: AuditLogQueryDto): PageDto<AuditLog> {
    const filters: SQL[] = [];
    if (queryDto.actorId) {
      filters.push(eq(auditLog.actorId, queryDto.actorId));
    }
    if (queryDto.action) {
      filters.push(eq(auditLog.action, queryDto.action));
    }
    if (queryDto.entityName) {
      filters.push(eq(auditLog.entityName, queryDto.entityName));
    }
    if (queryDto.entityId) {
      filters.push(eq(auditLog.entityId, queryDto.entityId));
    }

    return this.paginationFactory.paginate<AuditLog>({
      db: this.db,
      table: auditLog,
      pageOptions: queryDto,
      where: filters.length ? and(...filters) : undefined,
    });
  }
}
