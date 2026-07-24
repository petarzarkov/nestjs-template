import type { Database } from 'bun:sqlite';
import { and, eq, like, type SQL } from 'drizzle-orm';
import type { AuditLog } from '@/audit/entity/audit-log.entity';
import { AuditAction } from '@/audit/enum/audit-action.enum';
import { auditLog } from '@/audit/schema/audit-log.schema';
import { createDrizzleClient, type DrizzleDB } from '@/infra/db/client';
import type { User } from '@/users/entity/user.entity';
import { type NewUserRow, users } from '@/users/schema/user.schema';
import { E2E } from '../constants';

/**
 * E2E database client (Drizzle + bun:sqlite). Opens the same SQLite file the
 * app-under-test uses (WAL allows concurrent access) for direct setup/checks.
 */
export class DbClient {
  private db: DrizzleDB | null = null;
  private sqlite: Database | null = null;

  async initialize(): Promise<void> {
    if (this.db) {
      return;
    }
    const { db, sqlite } = createDrizzleClient(E2E.DB.PATH);
    this.db = db;
    this.sqlite = sqlite;
  }

  async destroy(): Promise<void> {
    this.sqlite?.close();
    this.db = null;
    this.sqlite = null;
  }

  private get client(): DrizzleDB {
    if (!this.db) {
      throw new Error('DbClient not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /** Raw Drizzle client, for building a standalone Better Auth instance. */
  get drizzle(): DrizzleDB {
    return this.client;
  }

  readonly users = {
    save: (values: NewUserRow): User =>
      this.client.insert(users).values(values).returning().get(),
    update: (id: string, partial: Partial<NewUserRow>): void => {
      this.client.update(users).set(partial).where(eq(users.id, id)).run();
    },
    delete: (where: { id?: string }): void => {
      if (where.id) {
        this.client.delete(users).where(eq(users.id, where.id)).run();
      }
    },
  };

  readonly auditLogs = {
    findOne: (opts: {
      where: { entityName?: string; entityId?: string; action?: AuditAction };
    }): AuditLog | null => {
      const conditions: SQL[] = [];
      if (opts.where.entityName) {
        conditions.push(eq(auditLog.entityName, opts.where.entityName));
      }
      if (opts.where.entityId) {
        conditions.push(eq(auditLog.entityId, opts.where.entityId));
      }
      if (opts.where.action) {
        conditions.push(eq(auditLog.action, opts.where.action));
      }
      return (
        this.client
          .select()
          .from(auditLog)
          .where(conditions.length ? and(...conditions) : undefined)
          .get() ?? null
      );
    },
    delete: (where: { entityId?: string }): void => {
      if (where.entityId) {
        this.client
          .delete(auditLog)
          .where(eq(auditLog.entityId, where.entityId))
          .run();
      }
    },
  };

  getUserByEmail(email: string): User | null {
    return (
      this.client.select().from(users).where(eq(users.email, email)).get() ??
      null
    );
  }

  cleanupTestUsers(emailPattern = '%@e2e-test.com'): number {
    const matched = this.client
      .select({ id: users.id })
      .from(users)
      .where(like(users.email, emailPattern))
      .all();
    this.client.delete(users).where(like(users.email, emailPattern)).run();
    return matched.length;
  }
}
