import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Equal, Expect } from '@/core/utils/type-equal';
import type { AuditLogRow } from '../schema/audit-log.schema';
import { AuditAction } from '../enum/audit-action.enum';

export class AuditLog {
  @ApiProperty({ description: 'Audit log entry ID' })
  id!: string;

  @ApiPropertyOptional({
    description: 'User ID of the actor (null for system actions)',
  })
  actorId!: string | null;

  @ApiProperty({ description: 'The action performed', enum: AuditAction })
  action!: AuditAction;

  @ApiProperty({ description: 'Name of the audited entity (e.g., "User")' })
  entityName!: string;

  @ApiProperty({ description: 'Primary key of the audited entity' })
  entityId!: string;

  @ApiPropertyOptional({ description: 'Previous values (UPDATE/DELETE only)' })
  oldValue!: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'New values (INSERT/UPDATE only)' })
  newValue!: Record<string, unknown> | null;

  @ApiProperty({ description: 'Timestamp of the audit event' })
  createdAt!: Date;
}

/** Compile-time drift guard: must match the Drizzle `audit_log` row. */
export type _AuditLogMatchesRow = Expect<Equal<AuditLog, AuditLogRow>>;
