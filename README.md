# Issue Lens

Point it at a public GitHub repo. It pulls the issues, an LLM sorts each one
into a fixed set of themes, and an agent answers questions about them.

A learning project: backend systems design and a hand-written LLM agent loop.

## Status

| | |
|---|---|
| Ingestion (GitHub → Postgres) | working, as a script |
| Agent loop + tools | working |
| LLM theme classification | not built yet |
| Queues (BullMQ) | not built yet |
| **UI** | **none — everything runs in the terminal** |

There is a React app in `client/`, but it is an empty Vite scaffold and is not
wired to anything. Use the commands below.

## Stack

Node + TypeScript · Postgres · Redis · Docker Compose · Zod ·
any OpenAI-compatible LLM (Gemini by default)

## Setup

```bash
# 1. config
cp .env.example .env
#    then fill in GITHUB_TOKEN and LLM_API_KEY

# 2. databases
colima start                 # only if you use Colima instead of Docker Desktop
docker compose up -d
docker compose ps            # wait for "healthy", not "running"

# 3. install
cd server && npm install

# 4. create the tables
npm run migrate
```

`GITHUB_TOKEN` — a classic personal access token with **no scopes ticked**.
Public repos need no permissions; it is only for the rate limit.

`LLM_API_KEY` — a free key from [aistudio.google.com](https://aistudio.google.com).
`.env.example` has alternative `LLM_BASE_URL` values for Groq and Ollama.

## Commands

All from `server/`.

```bash
npm run check:db                          # is Postgres reachable?
npm run migrate                           # apply any new migrations
npm run ingest:page <owner> <repo> <page> # fetch 100 issues and store them
npm run ask -- "your question"            # ask the agent
npm run typecheck
```

Get some data in:

```bash
npm run ingest:page facebook react 1
npm run ingest:page facebook react 2
npm run ingest:page facebook react 3
npm run ingest:page facebook react 4
```

Run the same page twice — the total must not change. That is the idempotency
check.

## Testing the agent

```bash
npm run ask -- "hi, what can you help me with?"          # no tools used
npm run ask -- "how many issues are in the database?"     # one tool
npm run ask -- "how many are open and how many closed?"   # two tools, in parallel
npm run ask -- "find an issue about performance and show me its full text"
npm run ask -- "what are the top complaints in the last 6 months?"
npm run ask -- "what is issue 999999 about?"              # error path
```

Every step prints the tokens used and each tool call with its arguments and
duration. Watch `tokens in` grow between steps — that is the messages array
being re-sent, which is the whole point of a stateless model API.

The agent has three tools: `searchIssues`, `getIssue`, `countIssues`.
It stops after 8 model calls per question, and a tool that hangs is cut off
after 10 seconds. Tool errors go back to the model as results, never as
exceptions, so it can recover.

## Looking at the database

```bash
docker compose exec postgres psql -U issuelens -d issuelens
```

Then `\dt` to list tables, `\d issue` to describe one, `\q` to quit.

Or connect any GUI to `localhost:5433`, user/password/database all `issuelens`.

## Layout

```
docker-compose.yml     Postgres + Redis
.env                   config for both Docker and the server
client/                React scaffold, not wired up
server/
  migrations/          numbered .sql files, run in order
  src/
    env.ts             reads .env
    db.ts              the connection pool
    migrate.ts         applies migrations not yet applied
    github.ts          fetch + the adaptor (GitHub's shape → ours)
    storage.ts         writes raw payloads to disk
    store.ts           the upserts
    ingest-page.ts     fetch → save raw → adapt → upsert
    tools.ts           the agent's three tools
    agent.ts           the loop
    ask.ts             CLI
```

## Schema

```
repo          owner, name, backfill_status, backfill_cursor
issue         repo_id, external_id, number, title, body, state, author,
              created_at (GitHub's), first_seen_at (ours),
              raw_payload_location
theme         name, description, taxonomy_version
insight       issue_id, theme_id, quote, sentiment, confidence,
              model_version, taxonomy_version
analysis_run  issue_id, status, attempts, error
sync_run      repo_id, kind, status
```

Two rules the schema enforces:

- `unique (repo_id, external_id)` on `issue` — a job can run twice without
  creating duplicates.
- `unique (issue_id, theme_id, model_version, taxonomy_version)` on `insight` —
  the same for LLM classification.

Raw payloads are kept forever in `server/data/raw/`. Anything derived from them
is versioned and can be re-run without re-downloading.

## What broke and what I changed

_To be written._
