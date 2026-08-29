create table issue (
  id          bigserial primary key,
  repo_id     bigint not null references repo(id) on delete cascade,

  external_id bigint not null,
  number      integer not null,

  title       text not null,
  body        text,
  state       text not null check (state in ('open', 'closed')),
  author      text,

  created_at  timestamptz not null,
  updated_at  timestamptz not null,
  closed_at   timestamptz,

  first_seen_at  timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),

  raw_payload_location text not null,

  unique (repo_id, external_id)
);

create index issue_repo_created_idx on issue (repo_id, created_at);
create index issue_repo_updated_idx on issue (repo_id, updated_at);
