create table analysis_run (
  id       bigserial primary key,
  issue_id bigint not null references issue(id) on delete cascade,

  taxonomy_version text not null,
  model_version    text not null,

  status text not null default 'pending'
    check (status in ('pending', 'running', 'ok', 'failed')),

  attempts integer not null default 0,
  error    text,

  started_at  timestamptz,
  finished_at timestamptz,

  unique (issue_id, taxonomy_version, model_version)
);

create index analysis_run_status_idx on analysis_run (status, taxonomy_version);
