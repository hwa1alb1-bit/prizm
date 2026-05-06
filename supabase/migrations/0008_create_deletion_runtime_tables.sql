-- Phase 4 Deletion and Evidence Runtime.
-- Runtime tables are server-write only. The service role bypasses RLS for cron,
-- auditor exports, and ops dashboard evidence reads.

create table deletion_sweep_run (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('cron','manual','test')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('ok','partial','failed')),
  expired_document_count int not null default 0,
  expired_statement_count int not null default 0,
  deleted_document_count int not null default 0,
  deleted_statement_count int not null default 0,
  s3_deleted_count int not null default 0,
  s3_absent_count int not null default 0,
  receipt_count int not null default 0,
  receipt_failure_count int not null default 0,
  survivor_count int not null default 0,
  error_detail text,
  created_at timestamptz not null default now()
);

create index deletion_sweep_run_started_idx on deletion_sweep_run(started_at desc);
create index deletion_sweep_run_status_idx on deletion_sweep_run(status, started_at desc);

create table deletion_receipt (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  document_id uuid not null references document(id) on delete cascade,
  recipient_user_id uuid references user_profile(id),
  recipient_email text,
  sent_at timestamptz not null,
  status text not null check (status in ('sent','failed')),
  error_code text,
  created_at timestamptz not null default now(),
  unique (document_id)
);

create index deletion_receipt_workspace_sent_idx
  on deletion_receipt(workspace_id, sent_at desc);

create index deletion_receipt_status_idx
  on deletion_receipt(status, sent_at desc);

alter table deletion_sweep_run enable row level security;
alter table deletion_receipt enable row level security;

create or replace view deletion_evidence as
select
  d.id as document_id,
  d.workspace_id,
  d.filename,
  d.s3_bucket,
  d.s3_key,
  d.expires_at,
  d.deleted_at,
  d.status as document_status,
  dr.status as receipt_status,
  dr.sent_at as receipt_sent_at,
  dr.error_code as receipt_error_code,
  max(ae.created_at) filter (where ae.event_type = 'document.deleted') as deletion_audited_at
from document d
left join deletion_receipt dr on dr.document_id = d.id
left join audit_event ae
  on ae.target_type = 'document'
  and ae.target_id = d.id
group by
  d.id,
  d.workspace_id,
  d.filename,
  d.s3_bucket,
  d.s3_key,
  d.expires_at,
  d.deleted_at,
  d.status,
  dr.status,
  dr.sent_at,
  dr.error_code;

create or replace view deletion_health as
with latest_run as (
  select *
  from deletion_sweep_run
  order by started_at desc
  limit 1
),
document_survivors as (
  select count(*)::int as count
  from document
  where expires_at < now() - interval '5 minutes'
    and deleted_at is null
),
statement_survivors as (
  select count(*)::int as count
  from statement
  where expires_at < now() - interval '5 minutes'
    and deleted_at is null
)
select
  case
    when document_survivors.count + statement_survivors.count > 0 then 'red'
    when latest_run.status = 'failed' then 'red'
    when latest_run.status = 'partial' then 'yellow'
    when coalesce(latest_run.receipt_failure_count, 0) > 0 then 'yellow'
    when latest_run.status = 'ok' then 'green'
    else 'gray'
  end as status,
  latest_run.started_at as last_sweep_at,
  latest_run.status as last_sweep_status,
  document_survivors.count + statement_survivors.count as expired_survivors,
  coalesce(latest_run.receipt_failure_count, 0) as receipt_failures
from document_survivors
cross join statement_survivors
left join latest_run on true;
