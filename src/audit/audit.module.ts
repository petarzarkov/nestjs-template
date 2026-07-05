import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditLogRepository } from './repos/audit-log.repository';
import { AuditService } from './services/audit.service';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditLogRepository],
  exports: [AuditService],
})
export class AuditModule {}
