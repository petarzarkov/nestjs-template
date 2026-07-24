import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Drops the local SQLite state: the main app DB (+ its WAL/SHM/journal
 * sidecars) and the bunqueue storage directory. The next boot starts from a
 * clean slate — migrations re-apply and the default admin + kiosk fleet
 * re-seed automatically (see UsersService/MachinesService onModuleInit).
 *
 * Reads `SQLITE_DB_PATH` / `QUEUE_DATA_PATH` from the environment (Bun
 * auto-loads `.env`), falling back to the same defaults the app uses.
 */
const dbPath = resolve(process.env.SQLITE_DB_PATH ?? './data/app.db');

const targets = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`];

let removed = 0;
for (const target of targets) {
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`🗑️  removed ${target}`);
    removed++;
  }
}

console.log(removed ? `Dropped ${removed} path(s).` : 'Nothing to drop.');
