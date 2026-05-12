-- Add the feature-flagged Cloudflare R2 storage and extraction path while
-- keeping AWS S3/Textract rows readable during the compatibility window.

alter table document
  add column if not exists storage_provider text,
  add column if not exists storage_bucket text,
  add column if not exists storage_key text;

update document
set
  storage_provider = 's3',
  storage_bucket = s3_bucket,
  storage_key = s3_key
where storage_provider is null
  or storage_bucket is null
  or storage_key is null;

alter table document
  alter column storage_provider set default 's3',
  alter column storage_provider set not null,
  alter column storage_bucket set not null,
  alter column storage_key set not null;

alter table document drop constraint if exists document_storage_provider_check;
alter table document
  add constraint document_storage_provider_check
  check (storage_provider in ('s3', 'r2'));

alter table document drop constraint if exists document_extraction_engine_check;
alter table document
  add constraint document_extraction_engine_check
  check (extraction_engine is null or extraction_engine in ('textract', 'kotlin_worker', 'cloudflare-r2'));

drop index if exists document_extraction_job_idx;
create unique index if not exists document_extraction_job_unique_idx
  on document(extraction_engine, extraction_job_id)
  where extraction_job_id is not null;

alter table statement
  add column if not exists extraction_ordinal int;

with ranked as (
  select
    id,
    row_number() over (partition by document_id order by created_at, id) - 1 as ordinal
  from statement
)
update statement s
set extraction_ordinal = ranked.ordinal
from ranked
where s.id = ranked.id
  and s.extraction_ordinal is null;

alter table statement
  alter column extraction_ordinal set default 0,
  alter column extraction_ordinal set not null;

alter table statement drop constraint if exists statement_document_extraction_ordinal_key;
alter table statement
  add constraint statement_document_extraction_ordinal_key
  unique(document_id, extraction_ordinal);

revoke update on public.document from authenticated;
revoke update on public.document from anon;

drop function if exists public.create_pending_document_upload_for_actor(
  uuid,
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
);

create or replace function public.create_pending_document_upload_for_actor(
  p_actor_user_id uuid,
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
  p_conversion_cost_credits int default 1,
  p_storage_provider text default 's3',
  p_storage_bucket text default null,
  p_storage_key text default null
)
returns table(document_id uuid, s3_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_role text;
  v_document_id uuid;
  v_duplicate_document_id uuid;
  v_storage_provider text := coalesce(p_storage_provider, 's3');
  v_storage_bucket text := coalesce(p_storage_bucket, p_s3_bucket);
  v_storage_key text := coalesce(p_storage_key, p_s3_key);
begin
  if p_actor_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if auth.uid() is not null and auth.uid() <> p_actor_user_id then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;

  if v_storage_provider not in ('s3', 'r2') then
    raise exception 'invalid_storage_provider' using errcode = '22023';
  end if;

  select up.workspace_id, up.role
  into v_workspace_id, v_role
  from public.user_profile up
  where up.id = p_actor_user_id;

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
    storage_provider,
    storage_bucket,
    storage_key,
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
    p_actor_user_id,
    'pending',
    p_s3_bucket,
    p_s3_key,
    v_storage_provider,
    v_storage_bucket,
    v_storage_key,
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
    p_actor_user_id,
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
      'storage_provider', v_storage_provider,
      'storage_bucket', v_storage_bucket,
      'storage_key', v_storage_key,
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

revoke all on function public.create_pending_document_upload_for_actor(
  uuid,
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
  int,
  text,
  text,
  text
) from anon, authenticated;
grant execute on function public.create_pending_document_upload_for_actor(
  uuid,
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
  int,
  text,
  text,
  text
) to service_role;
