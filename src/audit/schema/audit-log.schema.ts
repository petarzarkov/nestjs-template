import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt, uuidPk } from '@/infra/db/columns';
import { AuditAction } from '../enum/audit-action.enum';

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: uuidPk(),
    actorId: text(),
    action: text().$type<AuditAction>().notNull(),
    entityName: text().notNull(),
    entityId: text().notNull(),
    oldValue: text({ mode: 'json' }).$type<Record<string, unknown>>(),
    newValue: text({ mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  t => [
    index('audit_actor_id_index').on(t.actorId),
    index('audit_action_index').on(t.action),
    index('audit_entity_name_index').on(t.entityName),
    index('audit_entity_id_index').on(t.entityId),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
