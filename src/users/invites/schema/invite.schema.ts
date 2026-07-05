import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt, timestampMs, updatedAt, uuidPk } from '@/infra/db/columns';
import { UserRole } from '@/users/enum/user-role.enum';
import { InviteStatus } from '../enum/invite-status.enum';

export const invites = sqliteTable(
  'invite',
  {
    id: uuidPk(),
    email: text().notNull(),
    inviteCode: text().notNull(),
    role: text().$type<UserRole>().notNull(),
    status: text()
      .$type<InviteStatus>()
      .notNull()
      .default(InviteStatus.PENDING),
    expiresAt: timestampMs().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [
    uniqueIndex('UQ_invite_email').on(t.email),
    uniqueIndex('UQ_invite_invite_code').on(t.inviteCode),
  ],
);

export type InviteRow = typeof invites.$inferSelect;
export type NewInviteRow = typeof invites.$inferInsert;
