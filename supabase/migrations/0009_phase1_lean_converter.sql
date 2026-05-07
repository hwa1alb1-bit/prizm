-- Phase 1 lean converter workflow.
-- Adds one-PDF cost preflight, verified upload split, credit reservation,
-- editable statement review, export evidence, bad-extraction reports, and
-- hash/fingerprint scrubbing for the deletion lifecycle.

alter table document drop constraint if exists document_status_check;
alter table document
  add constraint document_status_check
  check (status in ('pending','verified','processing','ready','failed','expired'));

alter table document
  add column if not exists file_sha256 text,
  add column if not exists duplicate_of_document_id uuid references document(id),
  add column if not exists duplicate_checked_at timestamptz,
  add column if not exists duplicate_fingerprint jsonb,
  add column if not exists conversion_cost_credits int not null default 1,
  add column if not exists charge_status text not null default 'not_reserved',
  add column if not exists verified_at timestamptz,
  add column if not exists conversion_started_at timestamptz,
  add column if not exists converted_at timestamptz;

alter table document drop constraint if exists document_file_sha256_check;
alter table document
  add constraint document_file_sha256_check
  check (file_sha256 is null or file_sha256 ~ '^[0-9a-f]{64}$');

alter table document drop constraint if exists document_conversion_cost_credits_check;
alter table document
  add constraint document_conversion_cost_credits_check
  check (conversion_cost_credits = 1);

alter table document drop constraint if exists document_charge_status_check;
alter table document
  add constraint document_charge_status_check
  check (charge_status in ('not_reserved','reserved','consumed','released'));

create index if not exists document_workspace_active_hash_idx
  on document(workspace_id, file_sha256)
  where file_sha256 is not null and deleted_at is null and status <> 'expired';

create index if not exists document_duplicate_of_idx
  on document(duplicate_of_document_id)
  where duplicate_of_document_id is not null;

alter table statement
  add column if not exists revision int not null default 0,
  add column if not exists review_status text not null default 'unreviewed',
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by uuid references user_profile(id);

alter table statement drop constraint if exists statement_revision_check;
alter table statement
  add constraint statement_revision_check
  check (revision >= 0);

alter table statement drop constraint if exists statement_review_status_check;
alter table statement
  add constraint statement_review_status_check
  check (review_status in ('unreviewed','reviewed','invalid'));

create table credit_reservation (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  document_id uuid not null references document(id) on delete cascade,
  credits int not null check (credits = 1),
  status text not null check (status in ('reserved','consumed','released')),
  reserved_by uuid references user_profile(id),
  request_id text,
  trace_id text,
  reserved_at timestamptz not null default now(),
  consumed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id)
);

create index credit_reservation_workspace_status_idx
  on credit_reservation(workspace_id, status, reserved_at desc);

create table export_artifact (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  document_id uuid not null references document(id) on delete cascade,
  statement_id uuid not null references statement(id) on delete cascade,
  format text not null check (format in ('csv','xlsx','quickbooks_csv','xero_csv')),
  byte_size int not null check (byte_size >= 0),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid references user_profile(id),
  request_id text,
  trace_id text,
  created_at timestamptz not null default now()
);

create index export_artifact_document_created_idx
  on export_artifact(document_id, created_at desc);

create table extraction_report (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  document_id uuid not null references document(id) on delete cascade,
  statement_id uuid references statement(id) on delete set null,
  category text not null,
  note text,
  row_context jsonb,
  reported_by uuid references user_profile(id),
  request_id text,
  trace_id text,
  created_at timestamptz not null default now(),
  check (char_length(category) between 2 and 80),
  check (
    nullif(trim(coalesce(note, '')), '') is not null
    or row_context is not null
  )
);

create index extraction_report_document_created_idx
  on extraction_report(document_id, created_at desc);

alter table credit_reservation enable row level security;
alter table export_artifact enable row level security;
alter table extraction_report enable row level security;

create policy "credit_reservation_workspace_select" on credit_reservation
  for select using (
    workspace_id in (select workspace_id from user_profile where id = auth.uid())
  );

create policy "export_artifact_workspace_select" on export_artifact
  for select using (
    workspace_id in (select workspace_id from user_profile where id = auth.uid())
  );

create policy "extraction_report_workspace_select" on extraction_report
  for select using (
    workspace_id in (select workspace_id from user_profile where id = auth.uid())
  );

create or replace function public.create_pending_document_upload(
  p_filename text,
  p_content_type text,
  p_size_bytes bigint,
  p_s3_bucket text,
  p_s3_key text,
  p_expires_at timestamptz,
  p_request_id text,
  p_trace_id text,
  p_actor_ip inet default null,
  p_actor_user_agent text default null,
  p_file_sha256 text default null,
  p_conversion_cost_credits int default 1
)
returns table(document_id uuid, s3_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_role text;
  v_document_id uuid;
  v_duplicate_document_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select up.workspace_id, up.role
  into v_workspace_id, v_role
  from public.user_profile up
  where up.id = v_user_id;

  if v_workspace_id is null then
    raise exception 'workspace_profile_not_found' using errcode = '42501';
  end if;

  if v_role not in ('owner', 'admin', 'member') then
    raise exception 'workspace_write_forbidden' using errcode = '42501';
  end if;

  if p_conversion_cost_credits <> 1 then
    raise exception 'invalid_conversion_cost' using errcode = '22023';
  end if;

  if p_file_sha256 is null or p_file_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_file_sha256' using errcode = '22023';
  end if;

  select d.id
  into v_duplicate_document_id
  from public.document d
  where d.workspace_id = v_workspace_id
    and d.file_sha256 = p_file_sha256
    and d.deleted_at is null
    and d.status in ('pending','verified','processing','ready','failed')
  order by d.created_at desc
  limit 1;

  insert into public.document (
    filename,
    content_type,
    size_bytes,
    workspace_id,
    uploaded_by,
    status,
    s3_bucket,
    s3_key,
    expires_at,
    file_sha256,
    duplicate_of_document_id,
    duplicate_checked_at,
    duplicate_fingerprint,
    conversion_cost_credits,
    charge_status
  )
  values (
    p_filename,
    p_content_type,
    p_size_bytes,
    v_workspace_id,
    v_user_id,
    'pending',
    p_s3_bucket,
    p_s3_key,
    p_expires_at,
    p_file_sha256,
    v_duplicate_document_id,
    now(),
    jsonb_build_object('file_sha256', p_file_sha256),
    p_conversion_cost_credits,
    'not_reserved'
  )
  returning id into v_document_id;

  insert into public.audit_event (
    workspace_id,
    actor_user_id,
    actor_ip,
    actor_user_agent,
    event_type,
    target_type,
    target_id,
    metadata
  )
  values (
    v_workspace_id,
    v_user_id,
    p_actor_ip,
    p_actor_user_agent,
    'document.upload_requested',
    'document',
    v_document_id,
    jsonb_build_object(
      'filename', p_filename,
      'content_type', p_content_type,
      'size_bytes', p_size_bytes,
      's3_bucket', p_s3_bucket,
      's3_key', p_s3_key,
      'file_sha256', p_file_sha256,
      'duplicate_of_document_id', v_duplicate_document_id,
      'conversion_cost_credits', p_conversion_cost_credits,
      'request_id', p_request_id,
      'trace_id', p_trace_id
    )
  );

  document_id := v_document_id;
  s3_key := p_s3_key;
  return next;
end;
$$;

revoke all on function public.create_pending_document_upload(
  text,
  text,
  bigint,
  text,
  text,
  timestamptz,
  text,
  text,
  inet,
  text,
  text,
  int
) from public;

grant execute on function public.create_pending_document_upload(
  text,
  text,
  bigint,
  text,
  text,
  timestamptz,
  text,
  text,
  inet,
  text,
  text,
  int
) to authenticated;

create or replace function public.scrub_deleted_document(
  p_document_id uuid,
  p_deleted_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.statement
  set
    deleted_at = coalesce(deleted_at, p_deleted_at),
    transactions = '[]'::jsonb
  where document_id = p_document_id;

  update public.document
  set
    deleted_at = coalesce(deleted_at, p_deleted_at),
    status = 'expired',
    file_sha256 = null,
    duplicate_of_document_id = null,
    duplicate_checked_at = null,
    duplicate_fingerprint = null
  where id = p_document_id;
end;
$$;
