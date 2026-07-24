import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt, timestampMs, updatedAt, uuidPk } from '@/infra/db/columns';
import { users } from '@/users/schema/user.schema';

/**
 * Better Auth `account` table — one row per credential/OAuth link. Replaces the
 * old `auth_providers` table: `providerId` is `credential` for email/password
 * (hash in `password`) or `google`/`github`/`linkedin` for social logins.
 */
export const accounts = sqliteTable('account', {
  id: uuidPk(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestampMs(),
  refreshTokenExpiresAt: timestampMs(),
  scope: text(),
  password: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
