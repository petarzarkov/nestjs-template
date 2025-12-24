import { validateDbConfig } from '@/config/dto/db-vars.dto';
import fs from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

import { DataSource, type DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from './strategies/snake-case.strategy';

const { db } = validateDbConfig(process.env);

/**
 * Default PostgreSQL connection options
 */
export const dbOptions: DataSourceOptions = {
  type: 'postgres',
  host: db.host,
  port: db.port,
  username: db.user,
  password: db.pass,
  database: db.name,
  ssl:
    db.useSsl && db.caPath
      ? {
          ca: fs.readFileSync(join(cwd(), db.caPath)).toString(),
        }
      : false,
  synchronize: false,
  namingStrategy: new SnakeNamingStrategy(),
  entities: [join(cwd(), 'src/**/*.entity.{ts,js}')],
  migrations: [join(cwd(), 'src/db/migrations/**/*.{ts,js}')],
};

const dataSource = new DataSource(dbOptions);
export default dataSource;
