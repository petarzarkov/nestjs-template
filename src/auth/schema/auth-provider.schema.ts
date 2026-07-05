import { sql } from 'drizzle-orm';
import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt, updatedAt, uuidPk } from '@/infra/db/columns';
import { users } from '@/users/schema/user.schema';
import { OAuthProvider } from '../enum/oauth-provider.enum';

export const authProviders = sqliteTable(
  'auth_providers',
  {
    id: uuidPk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text().$type<OAuthProvider>().notNull(),
    authProviderId: text(),
    passwordHash: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [
    uniqueIndex('provider_auth_provider_id_index')
      .on(t.provider, t.authProviderId)
      .where(sql`${t.authProviderId} is not null`),
    uniqueIndex('user_provider_index').on(t.userId, t.provider),
  ],
);

export type AuthProviderRow = typeof authProviders.$inferSelect;
export type NewAuthProviderRow = typeof authProviders.$inferInsert;
