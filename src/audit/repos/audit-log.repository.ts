import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { PaginationFactory } from '@/core/pagination/pagination.factory';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { AuditLog } from '../entity/audit-log.entity';

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
    private readonly paginationFactory: PaginationFactory<AuditLog>,
  ) {}

  async findPaginated(queryDto: AuditLogQueryDto): Promise<PageDto<AuditLog>> {
    const qb = this.repository.createQueryBuilder('audit');

    if (queryDto.actorId) {
      qb.andWhere('audit.actorId = :actorId', { actorId: queryDto.actorId });
    }

    if (queryDto.action) {
      qb.andWhere('audit.action = :action', { action: queryDto.action });
    }

    if (queryDto.entityName) {
      qb.andWhere('audit.entityName = :entityName', {
        entityName: queryDto.entityName,
      });
    }

    if (queryDto.entityId) {
      qb.andWhere('audit.entityId = :entityId', {
        entityId: queryDto.entityId,
      });
    }

    return this.paginationFactory.paginate(qb, queryDto);
  }
}
