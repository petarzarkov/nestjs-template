import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/db/database.module';
import { AuditController } from './audit.controller';
import { AuditLog } from './entity/audit-log.entity';
import { AuditLogRepository } from './repos/audit-log.repository';
import { AuditService } from './services/audit.service';
import { AuditSubscriber } from './subscribers/audit.subscriber';

@Module({
  imports: [DatabaseModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditService, AuditLogRepository, AuditSubscriber],
  exports: [AuditService],
})
export class AuditModule {}
