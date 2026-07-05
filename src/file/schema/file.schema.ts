import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { createdAt, updatedAt, uuidPk } from '@/infra/db/columns';
import { users } from '@/users/schema/user.schema';

export const files = sqliteTable(
  'files',
  {
    id: uuidPk(),
    name: text().notNull(),
    extension: text().notNull(),
    mimetype: text().notNull(),
    path: text().notNull(),
    size: integer(),
    userId: text()
      .notNull()
      .references(() => users.id),
    width: integer(),
    height: integer(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [uniqueIndex('UQ_file_path').on(t.path)],
);

export type FileRow = typeof files.$inferSelect;
export type NewFileRow = typeof files.$inferInsert;
