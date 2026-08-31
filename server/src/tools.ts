import { z } from 'zod';
import { pool } from './db.js';

export type Tool = {
  name: string;
  description: string;
  schema: z.ZodType;
  run: (args: any) => Promise<unknown>;
};

const searchIssues: Tool = {
  name: 'searchIssues',
  description:
    'Search issues by keyword in the title or body. Use for questions like ' +
    '"find issues about crashes". Returns at most `limit` matches, newest first.',
  schema: z.object({
    query: z.string().describe('Keyword or phrase to look for'),
    state: z.enum(['open', 'closed', 'any']).default('any'),
    limit: z.number().int().min(1).max(25).default(10),
  }),
  async run({ query, state, limit }) {
    const { rows } = await pool.query(
      `select i.number, i.title, i.state, i.author,
              i.created_at::date as created_at,
              left(coalesce(i.body, ''), 200) as body_preview
       from issue i
       where (i.title ilike $1 or i.body ilike $1)
         and ($2 = 'any' or i.state = $2)
       order by i.created_at desc
       limit $3`,
      [`%${query}%`, state, limit],
    );
    return { count: rows.length, issues: rows };
  },
};

const getIssue: Tool = {
  name: 'getIssue',
  description:
    'Fetch one issue in full by its GitHub number (the #1234 people quote). ' +
    'Use after searchIssues when you need the whole body.',
  schema: z.object({
    number: z.number().int().positive().describe('The issue number, e.g. 4213'),
  }),
  async run({ number }) {
    const { rows } = await pool.query(
      `select i.number, i.title, i.body, i.state, i.author,
              i.created_at, i.closed_at, r.full_name as repo
       from issue i join repo r on r.id = i.repo_id
       where i.number = $1
       limit 1`,
      [number],
    );
    if (rows.length === 0) return { found: false, message: `No issue #${number} in the database.` };
    return { found: true, issue: rows[0] };
  },
};

const countIssues: Tool = {
  name: 'countIssues',
  description:
    'Count issues, optionally filtered by state and by when they were opened ' +
    'on GitHub. Use for "how many" questions. `since` is an ISO date, e.g. 2013-09-01.',
  schema: z.object({
    since: z.string().nullish().describe('ISO date. Only issues opened on or after this.'),
    until: z.string().nullish().describe('ISO date. Only issues opened before this.'),
    state: z.enum(['open', 'closed', 'any']).default('any'),
  }),
  async run({ since, until, state }) {
    const { rows } = await pool.query(
      `select count(*)::int as count,
              min(created_at)::date as oldest,
              max(created_at)::date as newest
       from issue
       where ($1::date is null or created_at >= $1::date)
         and ($2::date is null or created_at <  $2::date)
         and ($3 = 'any' or state = $3)`,
      [since ?? null, until ?? null, state],
    );
    return rows[0];
  },
};

export const TOOLS: Tool[] = [searchIssues, getIssue, countIssues];

export const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function toolDefinitions() {
  return TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: z.toJSONSchema(t.schema, { io: 'input' }) as Record<string, unknown>,
    },
  }));
}
