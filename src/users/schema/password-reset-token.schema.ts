import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt, timestampMs, updatedAt, uuidPk } from '@/infra/db/columns';
import { users } from './user.schema';

export const passwordResetTokens = sqliteTable('password_reset_token', {
  id: uuidPk(),
  userId: text()
    .notNull()
    .references(() => users.id),
  token: text().notNull(),
  used: integer({ mode: 'boolean' }).notNull().default(false),
  expiresAt: timestampMs().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetTokenRow = typeof passwordResetTokens.$inferInsert;
