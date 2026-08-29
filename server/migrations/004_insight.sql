create table insight (
  id       bigserial primary key,
  issue_id bigint not null references issue(id) on delete cascade,
  theme_id bigint not null references theme(id),

  quote      text not null,
  sentiment  text not null check (sentiment in ('positive', 'neutral', 'negative')),
  confidence real not null check (confidence >= 0 and confidence <= 1),

  model_version    text not null,
  taxonomy_version text not null,

  extracted_at timestamptz not null default now(),

  unique (issue_id, theme_id, model_version, taxonomy_version)
);

create index insight_theme_idx on insight (theme_id);
