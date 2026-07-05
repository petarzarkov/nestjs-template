import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { createdAt, updatedAt, uuidPk } from '@/infra/db/columns';
import { UserRole } from '../enum/user-role.enum';

export const users = sqliteTable(
  'user',
  {
    id: uuidPk(),
    email: text().notNull(),
    password: text(),
    displayName: text(),
    picture: text(),
    roles: text({ mode: 'json' }).$type<UserRole[]>().notNull(),
    suspended: integer({ mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [uniqueIndex('UQ_user_email').on(t.email)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
