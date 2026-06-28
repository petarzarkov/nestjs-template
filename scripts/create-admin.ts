import 'reflect-metadata';

import inquirer from 'inquirer';
import { DataSource } from 'typeorm';
import { BASE_USER_TEST_PASS } from '@/constants';
import { password as passwordUtil } from '@/core/utils/password.util';
import { dbOptions } from '@/infra/db/data-source-options';
import { User } from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';

async function createAdmin() {
  const datasource = new DataSource(dbOptions);
  try {
    await datasource.initialize();

    const userRepository = datasource.getRepository(User);

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

    // Upsert: if the admin already exists, reset its credentials so re-running
    // this command is a reliable way to recover/rotate the admin password
    // (a previously-seeded user keeps its old hash otherwise).
    const existing = await userRepository.findOne({ where: { email } });
    const user =
      existing ?? userRepository.create({ email, roles: [UserRole.ADMIN] });

    user.password = hashedPassword;
    user.roles = [UserRole.ADMIN];
    user.suspended = false;

    const result = await userRepository.save(user);

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
    if (datasource.isInitialized) {
      await datasource.destroy();
    }
  }
}

await createAdmin();
