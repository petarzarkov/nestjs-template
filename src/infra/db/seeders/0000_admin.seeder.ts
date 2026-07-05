import { eq } from 'drizzle-orm';
import { password as passwordUtil } from '@/core/utils/password.util';
import type { DrizzleDB } from '@/infra/db/client';
import { UserRole } from '@/users/enum/user-role.enum';
import { users } from '@/users/schema/user.schema';

/**
 * Seeders run like migrations (tracked, once, in order) but from a separate
 * folder + runner (`scripts/seed.ts`) — Drizzle has no native seeder concept.
 */
export async function seed(db: DrizzleDB): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@local.dev';
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    return;
  }
  const password = await passwordUtil.hash(
    process.env.SEED_ADMIN_PASSWORD ?? 'Admin123$',
  );
  db.insert(users)
    .values({ email, password, roles: [UserRole.ADMIN], suspended: false })
    .run();
}
