-- Atomic document intake write.
-- Creates the pending document row and its audit event in one database
-- transaction so presign cannot leave an unaudited user-data mutation.

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
  p_actor_user_agent text default null
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

  insert into public.document (
    filename,
    content_type,
    size_bytes,
    workspace_id,
    uploaded_by,
    status,
    s3_bucket,
    s3_key,
    expires_at
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
    p_expires_at
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
  text
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
  text
) to authenticated;
