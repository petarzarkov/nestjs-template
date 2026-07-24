import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt, timestampMs, updatedAt, uuidPk } from '@/infra/db/columns';

/**
 * Better Auth `verification` table — short-lived tokens for email verification
 * and password reset (replaces the old `password_reset_token` table).
 */
export const verifications = sqliteTable('verification', {
  id: uuidPk(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestampMs().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type VerificationRow = typeof verifications.$inferSelect;
export type NewVerificationRow = typeof verifications.$inferInsert;
