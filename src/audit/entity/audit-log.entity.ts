import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { withDateFormat } from '@/core/zod/entity-schema';
import { auditLog } from '../schema/audit-log.schema';
import { AuditAction } from '../enum/audit-action.enum';

/** Audit log row/response shape, derived from the Drizzle `audit_log` table. */
export const auditLogSelectSchema = withDateFormat(
  createSelectSchema(auditLog, {
    action: z.enum(AuditAction),
    oldValue: z.record(z.string(), z.unknown()).nullable(),
    newValue: z.record(z.string(), z.unknown()).nullable(),
  }),
);

export class AuditLog extends createZodDto(auditLogSelectSchema) {}
