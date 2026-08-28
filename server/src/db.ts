import pg from 'pg';
import { env } from './env.js';

export const pool = new pg.Pool({
  host: env.postgres.host,
  port: env.postgres.port,
  user: env.postgres.user,
  password: env.postgres.password,
  database: env.postgres.database,
});
