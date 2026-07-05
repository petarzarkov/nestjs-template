import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/infra/db/schema.ts',
  out: './src/infra/db/migrations',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.SQLITE_DB_PATH ?? './data/app.db',
  },
});
