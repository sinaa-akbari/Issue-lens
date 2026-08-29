create table repo (
  id           bigserial primary key,
  owner        text not null,
  name         text not null,
  full_name    text generated always as (owner || '/' || name) stored,
  connected_at timestamptz not null default now(),

  backfill_status text not null default 'pending'
    check (backfill_status in ('pending', 'running', 'done', 'failed', 'paused')),

  backfill_cursor integer not null default 1,

  unique (owner, name)
);
