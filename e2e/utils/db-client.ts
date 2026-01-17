import type { Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from '@/infra/db/strategies/snake-case.strategy';
import { PasswordResetToken } from '@/users/entity/password-reset-token.entity';
import { User } from '@/users/entity/user.entity';
import { Invite } from '@/users/invites/entity/invite.entity';
import { E2E } from '../constants';

// Entity list for this template
const ENTITIES = [User, Invite, PasswordResetToken];

/**
 * E2E Database Client using TypeORM
 * Provides direct access to entities for test setup/verification
 */
export class DbClient {
  private dataSource: DataSource | null = null;

  async initialize(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      return;
    }

    this.dataSource = new DataSource({
      type: 'postgres',
      host: E2E.DB.HOST,
      port: E2E.DB.PORT,
      username: E2E.DB.USER,
      password: E2E.DB.PASS,
      database: E2E.DB.NAME,
      ssl: false,
      synchronize: false,
      namingStrategy: new SnakeNamingStrategy(),
      entities: ENTITIES,
      logging: false,
    });

    await this.dataSource.initialize();
  }

  async destroy(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      await this.dataSource.destroy();
      this.dataSource = null;
    }
  }

  private getDataSource(): DataSource {
    if (!this.dataSource?.isInitialized) {
      throw new Error('DbClient not initialized. Call initialize() first.');
    }
    return this.dataSource;
  }

  /**
   * Get a repository for any entity
   */
  getRepository<T extends object>(entity: new () => T): Repository<T> {
    return this.getDataSource().getRepository(entity);
  }

  /**
   * Execute raw SQL query
   */
  async query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]> {
    return this.getDataSource().query(sql, parameters);
  }

  // Convenience repository getters
  get users(): Repository<User> {
    return this.getRepository(User);
  }

  get invites(): Repository<Invite> {
    return this.getRepository(Invite);
  }

  get passwordResetTokens(): Repository<PasswordResetToken> {
    return this.getRepository(PasswordResetToken);
  }

  /**
   * Clean up test users by email pattern
   * @param emailPattern - SQL LIKE pattern (e.g., '%@test.e2e%')
   */
  async cleanupTestUsers(emailPattern = '%@e2e-test.com'): Promise<number> {
    // Delete related records first
    await this.invites
      .createQueryBuilder()
      .delete()
      .where('email LIKE :pattern', { pattern: emailPattern })
      .execute();

    await this.passwordResetTokens
      .createQueryBuilder()
      .delete()
      .where('user_id IN (SELECT id FROM "user" WHERE email LIKE :pattern)', {
        pattern: emailPattern,
      })
      .execute();

    // Delete users
    const result = await this.users
      .createQueryBuilder()
      .delete()
      .where('email LIKE :pattern', { pattern: emailPattern })
      .execute();

    return result.affected ?? 0;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email } });
  }
}
