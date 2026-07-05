import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_DB, type DrizzleDB } from '@/infra/db/database.module';
import type { User } from '@/users/entity/user.entity';
import { users } from '@/users/schema/user.schema';
import { AuthProvider } from '../entity/auth-provider.entity';
import { OAuthProvider } from '../enum/oauth-provider.enum';
import {
  authProviders,
  type NewAuthProviderRow,
} from '../schema/auth-provider.schema';

@Injectable()
export class AuthProvidersRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  findByProviderAndAuthProviderId(
    provider: OAuthProvider,
    authProviderId: string,
  ): (Omit<AuthProvider, 'user'> & { user: User | null }) | null {
    const row = this.db
      .select()
      .from(authProviders)
      .where(
        and(
          eq(authProviders.provider, provider),
          eq(authProviders.authProviderId, authProviderId),
        ),
      )
      .get();
    if (!row) {
      return null;
    }
    const user =
      this.db.select().from(users).where(eq(users.id, row.userId)).get() ??
      null;
    return { ...row, user };
  }

  findByUserIdAndProvider(
    userId: string,
    provider: OAuthProvider,
  ): AuthProvider | null {
    return (
      this.db
        .select()
        .from(authProviders)
        .where(
          and(
            eq(authProviders.userId, userId),
            eq(authProviders.provider, provider),
          ),
        )
        .get() ?? null
    );
  }

  save(provider: NewAuthProviderRow): AuthProvider {
    return this.db.insert(authProviders).values(provider).returning().get();
  }

  updatePasswordHash(id: string, passwordHash: string | null): void {
    this.db
      .update(authProviders)
      .set({ passwordHash })
      .where(eq(authProviders.id, id))
      .run();
  }
}
