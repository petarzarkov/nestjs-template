import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt, timestampMs, updatedAt, uuidPk } from '@/infra/db/columns';
import { users } from '@/users/schema/user.schema';

/** Better Auth `session` table (+ `impersonatedBy` from the admin plugin). */
export const sessions = sqliteTable(
  'session',
  {
    id: uuidPk(),
    token: text().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestampMs().notNull(),
    ipAddress: text(),
    userAgent: text(),
    impersonatedBy: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [uniqueIndex('UQ_session_token').on(t.token)],
);

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
