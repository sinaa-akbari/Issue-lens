import { pool } from './db.js';

const { rows } = await pool.query(`
  select
    current_database() as database,
    current_user      as "user",
    inet_server_port() as port,
    now()             as server_time
`);

console.log('connected to Postgres:');
console.log(rows[0]);

await pool.end();
