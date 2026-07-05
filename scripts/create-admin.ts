import { eq } from 'drizzle-orm';
import inquirer from 'inquirer';
import { BASE_USER_TEST_PASS } from '@/constants';
import { password as passwordUtil } from '@/core/utils/password.util';
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
    const hashedPassword = await passwordUtil.hash(password);

    const existing = db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    // Upsert: re-running rotates the admin's credentials.
    const result = db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        roles: [UserRole.ADMIN],
        suspended: false,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          password: hashedPassword,
          roles: [UserRole.ADMIN],
          suspended: false,
          updatedAt: new Date(),
        },
      })
      .returning()
      .get();

    console.log(existing ? 'Admin user updated.' : 'User created.');
    console.table({
      id: result.id,
      email: result.email,
      roles: result.roles,
      suspended: result.suspended,
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
