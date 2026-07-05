import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createDrizzleClient, type DrizzleDB } from '@/infra/db/client';

/**
 * Migration-style seeder runner. Applies each `*.seeder.ts` in
 * `src/infra/db/seeders/` exactly once, in filename order, tracked in the
 * `__seeders` table.
 */
const SEEDERS_DIR = join(
  import.meta.dir,
  '..',
  'src',
  'infra',
  'db',
  'seeders',
);
const sqlitePath = process.env.SQLITE_DB_PATH ?? './data/app.db';

async function run() {
  const { db, sqlite } = createDrizzleClient(sqlitePath);
  try {
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS __seeders (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`,
    );
    const applied = new Set(
      (
        sqlite.query('SELECT name FROM __seeders').all() as { name: string }[]
      ).map(r => r.name),
    );

    const files = readdirSync(SEEDERS_DIR)
      .filter(f => f.endsWith('.seeder.ts'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }
      const mod = (await import(join(SEEDERS_DIR, file))) as {
        seed: (db: DrizzleDB) => Promise<void> | void;
      };
      await mod.seed(db);
      sqlite
        .query('INSERT INTO __seeders (name, applied_at) VALUES (?, ?)')
        .run(file, Date.now());
      console.log(`✅ seeded ${file}`);
      count++;
    }
    console.log(count ? `Applied ${count} seeder(s).` : 'No new seeders.');
  } finally {
    sqlite.close();
  }
}

await run();
