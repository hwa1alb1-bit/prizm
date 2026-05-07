-- Persist downloadable export artifacts for the POST /exports + signed download flow.

alter table export_artifact
  add column if not exists filename text,
  add column if not exists s3_bucket text,
  add column if not exists s3_key text,
  add column if not exists content_type text,
  add column if not exists expires_at timestamptz,
  add column if not exists deleted_at timestamptz;

update export_artifact ea
set expires_at = d.expires_at
from document d
where ea.document_id = d.id
  and ea.expires_at is null;

create index if not exists export_artifact_workspace_active_idx
  on export_artifact(workspace_id, expires_at, created_at desc)
  where deleted_at is null;

create index if not exists export_artifact_storage_key_idx
  on export_artifact(s3_bucket, s3_key)
  where s3_bucket is not null and s3_key is not null and deleted_at is null;

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

  update public.export_artifact
  set deleted_at = coalesce(deleted_at, p_deleted_at)
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
