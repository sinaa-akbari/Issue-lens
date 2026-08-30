create table sync_run (
  id      bigserial primary key,
  repo_id bigint not null references repo(id) on delete cascade,

  kind text not null check (kind in ('live', 'backfill')),

  status text not null default 'running'
    check (status in ('running', 'done', 'failed', 'paused')),

  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  error       text
);

create index sync_run_repo_idx on sync_run (repo_id, started_at desc);
