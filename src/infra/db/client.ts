import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Database } from 'bun:sqlite';
import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from './schema';
import { applyAuditTriggers } from './triggers';

export type DrizzleDB = BunSQLiteDatabase<typeof schema>;

const MIGRATIONS_FOLDER = join(import.meta.dir, 'migrations');

/**
 * Builds a synchronous drizzle client over Bun's native `bun:sqlite`.
 * Shared by the Nest {@link DatabaseModule} and the CLI scripts
 * (migrations, seeders, create-admin, e2e).
 */
export const createDrizzleClient = (
  sqlitePath: string,
): { sqlite: Database; db: DrizzleDB } => {
  if (sqlitePath !== ':memory:') {
    mkdirSync(dirname(sqlitePath), { recursive: true });
  }
  const sqlite = new Database(sqlitePath, { create: true });
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const db = drizzle(sqlite, { schema, casing: 'snake_case' });
  // Auto-apply schema migrations on boot (the SQLite-first "synchronize"),
  // then (re)install the audit triggers idempotently.
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  applyAuditTriggers(sqlite);
  return { sqlite, db };
};
