import { eq } from 'drizzle-orm';
import inquirer from 'inquirer';
import { buildStandaloneAuth } from '@/auth/auth.config';
import { BASE_USER_TEST_PASS } from '@/constants';
import { createDrizzleClient } from '@/infra/db/client';
import { UserRole } from '@/users/enum/user-role.enum';
import { users } from '@/users/schema/user.schema';

const sqlitePath = process.env.SQLITE_DB_PATH ?? './data/app.db';

async function createAdmin() {
  const { db, sqlite } = createDrizzleClient(sqlitePath);
  try {
    console.log('Creating admin user');
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: 'Enter the admin email:',
        default: 'test@test.com',
      },
      {
        type: 'password',
        name: 'password',
        message: 'Enter the admin password:',
        default: BASE_USER_TEST_PASS,
        mask: '*',
        validate: (v: string) =>
          v.length >= 8 ? true : 'Password must be min 8 chars long',
      },
    ]);

    const { email, password } = answers;
    const existing = db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (existing) {
      // Re-running promotes an existing account to admin (Better Auth owns the
      // credential, so we don't rotate the password here).
      db.update(users)
        .set({ role: UserRole.ADMIN, banned: false, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .run();
      console.log('Existing user promoted to admin.');
      console.table({
        id: existing.id,
        email: existing.email,
        role: UserRole.ADMIN,
      });
      return;
    }

    const auth = buildStandaloneAuth(db);
    const { user } = await auth.api.signUpEmail({
      body: { email, password, name: email.split('@')[0] },
    });
    const result = db
      .update(users)
      .set({ role: UserRole.ADMIN })
      .where(eq(users.id, user.id))
      .returning()
      .get();

    console.log('Admin user created.');
    console.table({
      id: result.id,
      email: result.email,
      role: result.role,
      banned: result.banned,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    console.error('Error creating admin user', error);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

await createAdmin();
