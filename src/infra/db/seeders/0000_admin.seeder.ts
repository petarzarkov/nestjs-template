import { eq } from 'drizzle-orm';
import { buildStandaloneAuth } from '@/auth/auth.config';
import type { DrizzleDB } from '@/infra/db/client';
import { UserRole } from '@/users/enum/user-role.enum';
import { users } from '@/users/schema/user.schema';

/**
 * Seeders run like migrations (tracked, once, in order) but from a separate
 * folder + runner (`scripts/seed.ts`) — Drizzle has no native seeder concept.
 *
 * The admin is created through Better Auth (`auth.api.signUpEmail`) so the
 * scrypt password hash + `account` row are correct, then promoted to `admin`
 * with a direct column update (bootstrapping the first admin cannot go through
 * the admin-only `setRole` endpoint).
 */
export async function seed(db: DrizzleDB): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@local.dev';
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    return;
  }

  const auth = buildStandaloneAuth(db);
  const { user } = await auth.api.signUpEmail({
    body: {
      email,
      password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123$',
      name: email.split('@')[0],
    },
  });

  db.update(users)
    .set({ role: UserRole.ADMIN })
    .where(eq(users.id, user.id))
    .run();
}
