import type pg from 'pg';
import { pool } from './db.js';
import type { IssueRow } from './github.js';

export type Db = pg.Pool | pg.PoolClient;

export async function upsertRepo(owner: string, name: string, db: Db = pool): Promise<number> {
  const { rows } = await db.query<{ id: string }>(
    `insert into repo (owner, name)
     values ($1, $2)
     on conflict (owner, name) do update set owner = excluded.owner
     returning id`,
    [owner, name],
  );
  return Number(rows[0]!.id);
}

const ISSUE_COLUMNS = [
  'repo_id',
  'external_id',
  'number',
  'title',
  'body',
  'state',
  'author',
  'created_at',
  'updated_at',
  'closed_at',
  'raw_payload_location',
] as const;

export async function upsertIssues(rows: IssueRow[], db: Db = pool): Promise<number> {
  if (rows.length === 0) return 0;

  const values: unknown[] = [];
  const tuples = rows.map((row, i) => {
    const offset = i * ISSUE_COLUMNS.length;
    values.push(
      row.repo_id,
      row.external_id,
      row.number,
      row.title,
      row.body,
      row.state,
      row.author,
      row.created_at,
      row.updated_at,
      row.closed_at,
      row.raw_payload_location,
    );
    return `(${ISSUE_COLUMNS.map((_, j) => `$${offset + j + 1}`).join(', ')})`;
  });

  const result = await db.query(
    `insert into issue (${ISSUE_COLUMNS.join(', ')})
     values ${tuples.join(', ')}
     on conflict (repo_id, external_id) do update set
       title                = excluded.title,
       body                 = excluded.body,
       state                = excluded.state,
       author               = excluded.author,
       updated_at           = excluded.updated_at,
       closed_at            = excluded.closed_at,
       raw_payload_location = excluded.raw_payload_location,
       last_synced_at       = now()`,
    values,
  );

  return result.rowCount ?? 0;
}
