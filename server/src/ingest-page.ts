import { env } from './env.js';
import { pool } from './db.js';
import { fetchIssuesPage, isPullRequest, toIssueRow, type IssueRow } from './github.js';
import { saveRawPage } from './storage.js';
import { upsertRepo, upsertIssues } from './store.js';

const owner = process.argv[2] ?? 'facebook';
const name = process.argv[3] ?? 'react';
const page = Number(process.argv[4] ?? 1);

console.log(`ingesting ${owner}/${name} page ${page}\n`);

const repoId = await upsertRepo(owner, name);
console.log(`repo id           ${repoId}`);

const { items, rateLimit } = await fetchIssuesPage(owner, name, page, env.githubToken);
console.log(`fetched           ${items.length} items`);
console.log(`requests left     ${rateLimit.remaining} / ${rateLimit.limit}`);

const key = await saveRawPage(owner, name, page, items);
console.log(`raw saved         ${key}`);

const issuesOnly = items.filter((i) => !isPullRequest(i));
console.log(`pull requests     ${items.length - issuesOnly.length}  (dropped)`);

const rows: IssueRow[] = [];
const skipped: string[] = [];
const warnings: string[] = [];

for (const [index, item] of issuesOnly.entries()) {
  const result = toIssueRow(item, repoId, key);
  if (result.ok) {
    rows.push(result.row);
    warnings.push(...result.warnings);
  } else {
    skipped.push(`  item ${index}: ${result.errors.join(' | ')}`);
  }
}

const written = await upsertIssues(rows);

console.log(`adapted           ${rows.length}`);
console.log(`skipped           ${skipped.length}`);
console.log(`rows written      ${written}`);

if (warnings.length) {
  console.log(`\nwarnings (${warnings.length}):`);
  for (const w of [...new Set(warnings)]) console.log(`  ${w}`);
}
if (skipped.length) {
  console.log(`\nskipped:`);
  for (const s of skipped) console.log(s);
}

const { rows: counted } = await pool.query<{ count: string }>(
  'select count(*) as count from issue where repo_id = $1',
  [repoId],
);
console.log(`\nTOTAL issues in db for ${owner}/${name}: ${counted[0]!.count}`);

await pool.end();
