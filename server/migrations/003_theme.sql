create table theme (
  id          bigserial primary key,
  name        text not null,
  description text not null,

  taxonomy_version text not null,

  unique (taxonomy_version, name)
);
