import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { createdAt, timestampMs, updatedAt, uuidPk } from '@/infra/db/columns';
import { UserRole } from '../enum/user-role.enum';

/**
 * Better Auth core `user` table + the `admin` plugin fields (`role`, `banned`,
 * `banReason`, `banExpires`). Field names match Better Auth's native model
 * (`name`, `image`, `emailVerified`) so the session-user object returned by
 * Better Auth is structurally identical to a selected row — one `SanitizedUser`
 * type flows everywhere. Credentials (password) and OAuth links live in the
 * `account` table.
 */
export const users = sqliteTable(
  'user',
  {
    id: uuidPk(),
    email: text().notNull(),
    emailVerified: integer({ mode: 'boolean' }).notNull().default(false),
    name: text().notNull(),
    image: text(),
    role: text().$type<UserRole>().notNull().default(UserRole.USER),
    banned: integer({ mode: 'boolean' }).notNull().default(false),
    banReason: text(),
    banExpires: timestampMs(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [uniqueIndex('UQ_user_email').on(t.email)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
