alter table statement
  add column if not exists statement_type text not null default 'bank',
  add column if not exists statement_metadata jsonb not null default '{}'::jsonb;

alter table statement drop constraint if exists statement_statement_type_check;
alter table statement
  add constraint statement_statement_type_check
  check (statement_type in ('bank','credit_card'));
