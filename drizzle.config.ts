import { defineConfig } from 'drizzle-kit';
import { validateDbConfig } from './src/config/dto/db-vars.dto';

const {
  db: { host, port, user, pass, name, useSsl, caPath },
} = validateDbConfig(process.env);

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host,
    port,
    user,
    password: pass,
    database: name,
    ssl: useSsl
      ? {
          ca: caPath ? require('fs').readFileSync(caPath).toString() : undefined,
          rejectUnauthorized: true,
        }
      : false,
  },
});
