import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { STRING_LENGTH } from '@/constants';
import { pageOptionsSchema } from '@/core/pagination/dto/page-options.dto';
import { AuditAction } from '../enum/audit-action.enum';

export const auditLogQuerySchema = pageOptionsSchema.extend({
  actorId: z.uuid().optional().describe('Filter by actor user ID'),
  action: z.enum(AuditAction).optional().describe('Filter by action type'),
  entityName: z
    .string()
    .min(1)
    .max(STRING_LENGTH.MEDIUM_MAX)
    .optional()
    .describe('Filter by entity name (e.g., "User")'),
  entityId: z
    .string()
    .min(1)
    .max(STRING_LENGTH.SHORT_MAX)
    .optional()
    .describe('Filter by entity ID'),
});

export class AuditLogQueryDto extends createZodDto(auditLogQuerySchema) {}
