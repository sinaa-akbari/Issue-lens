import { env } from './env.js';
import { isPullRequest } from './github.js';

const owner = process.argv[2] ?? 'facebook';
const name = process.argv[3] ?? 'react';
const page = Number(process.argv[4] ?? 1);

const url = new URL(`https://api.github.com/repos/${owner}/${name}/issues`);
url.searchParams.set('state', 'all');        // default is open only
url.searchParams.set('per_page', '100');
url.searchParams.set('sort', 'created');     // oldest first, so pages never shift
url.searchParams.set('direction', 'asc');
url.searchParams.set('page', String(page));

console.log(`GET ${url}\n`);

const res = await fetch(url, {
  headers: {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    ...(env.githubToken ? { authorization: `Bearer ${env.githubToken}` } : {}),
  },
});

console.log(`status            ${res.status} ${res.statusText}`);
console.log(`requests left     ${res.headers.get('x-ratelimit-remaining')} / ${res.headers.get('x-ratelimit-limit')}`);

const reset = res.headers.get('x-ratelimit-reset');
if (reset) console.log(`limit resets at   ${new Date(Number(reset) * 1000).toLocaleTimeString()}`);

if (!res.ok) {
  console.error('\n' + (await res.text()));
  process.exit(1);
}

// This script only prints. The real parsing happens in github.ts.
type Displayed = { number: number; title: string; state: string; created_at: string; pull_request?: unknown };
const items = (await res.json()) as Displayed[];
const issues = items.filter((i) => !isPullRequest(i));
const prs = items.length - issues.length;

console.log(`\nreturned          ${items.length} items`);
console.log(`pull requests     ${prs}  (dropped)`);
console.log(`real issues       ${issues.length}\n`);

for (const i of issues.slice(0, 10)) {
  console.log(`#${String(i.number).padEnd(6)} ${i.created_at.slice(0, 10)}  ${i.state.padEnd(6)} ${i.title.slice(0, 60)}`);
}
