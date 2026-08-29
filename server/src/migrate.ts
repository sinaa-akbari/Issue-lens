import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './db.js';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../migrations');
const LOCK_ID = 727001;

async function main() {
  const client = await pool.connect();

  try {
    await client.query('select pg_advisory_lock($1)', [LOCK_ID]);

    await client.query(`
      create table if not exists schema_migrations (
        filename   text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const { rows } = await client.query<{ filename: string }>(
      'select filename from schema_migrations',
    );
    const alreadyApplied = new Set(rows.map((r) => r.filename));

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

    let applied = 0;
    for (const file of files) {
      if (alreadyApplied.has(file)) {
        console.log(`  skip   ${file}`);
        continue;
      }

      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');

      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (filename) values ($1)', [file]);
        await client.query('commit');
        console.log(`  apply  ${file}`);
        applied++;
      } catch (err) {
        await client.query('rollback');
        console.error(`  FAILED ${file}`);
        throw err;
      }
    }

    console.log(applied === 0 ? 'nothing to do' : `${applied} migration(s) applied`);
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_ID]).catch(() => { });
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
