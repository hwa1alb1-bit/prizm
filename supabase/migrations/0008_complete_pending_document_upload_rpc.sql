-- Atomic upload completion and Textract job attachment writes.
-- The route claims processing before provider work so Textract cannot start
-- without durable document state and audit evidence.

create or replace function public.claim_pending_document_upload_completion(
  p_document_id uuid,
  p_actor_user_id uuid,
  p_textract_client_token text,
  p_request_id text,
  p_trace_id text,
  p_actor_ip inet default null,
  p_actor_user_agent text default null
)
returns table(document_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_role text;
  v_document record;
begin
  if p_actor_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
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

  select d.*
  into v_document
  from public.document d
  where d.id = p_document_id
    and d.workspace_id = v_workspace_id
    and d.deleted_at is null
    and d.expires_at > now()
  for update;

  if v_document.id is null then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;

  if v_document.status <> 'pending' then
    raise exception 'document_not_pending' using errcode = 'P0001';
  end if;

  update public.document
  set status = 'processing',
      textract_job_id = null,
      failure_reason = null
  where id = p_document_id;

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
  values
    (
      v_workspace_id,
      p_actor_user_id,
      p_actor_ip,
      p_actor_user_agent,
      'document.upload_completed',
      'document',
      p_document_id,
      jsonb_build_object(
        's3_bucket', v_document.s3_bucket,
        's3_key', v_document.s3_key,
        'size_bytes', v_document.size_bytes,
        'content_type', v_document.content_type,
        'request_id', p_request_id,
        'trace_id', p_trace_id
      )
    ),
    (
      v_workspace_id,
      p_actor_user_id,
      p_actor_ip,
      p_actor_user_agent,
      'document.processing_started',
      'document',
      p_document_id,
      jsonb_build_object(
        'textract_client_token', p_textract_client_token,
        'request_id', p_request_id,
        'trace_id', p_trace_id
      )
    );

  document_id := p_document_id;
  status := 'processing';
  return next;
end;
$$;

create or replace function public.attach_document_textract_job(
  p_document_id uuid,
  p_actor_user_id uuid,
  p_textract_job_id text,
  p_request_id text,
  p_trace_id text
)
returns table(document_id uuid, status text, textract_job_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_role text;
  v_document record;
begin
  if p_actor_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
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

  select d.*
  into v_document
  from public.document d
  where d.id = p_document_id
    and d.workspace_id = v_workspace_id
    and d.deleted_at is null
    and d.expires_at > now()
  for update;

  if v_document.id is null then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;

  if v_document.status <> 'processing' then
    raise exception 'document_not_pending' using errcode = 'P0001';
  end if;

  update public.document
  set textract_job_id = p_textract_job_id
  where id = p_document_id;

  insert into public.audit_event (
    workspace_id,
    actor_user_id,
    event_type,
    target_type,
    target_id,
    metadata
  )
  values (
    v_workspace_id,
    p_actor_user_id,
    'document.textract_job_recorded',
    'document',
    p_document_id,
    jsonb_build_object(
      'textract_job_id', p_textract_job_id,
      'request_id', p_request_id,
      'trace_id', p_trace_id
    )
  );

  document_id := p_document_id;
  status := 'processing';
  textract_job_id := p_textract_job_id;
  return next;
end;
$$;

create or replace function public.mark_document_processing_failed(
  p_document_id uuid,
  p_actor_user_id uuid,
  p_failure_reason text,
  p_textract_job_id text,
  p_request_id text,
  p_trace_id text
)
returns table(document_id uuid, status text, failure_reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_role text;
  v_document record;
begin
  if p_actor_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
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

  select d.*
  into v_document
  from public.document d
  where d.id = p_document_id
    and d.workspace_id = v_workspace_id
    and d.deleted_at is null
    and d.expires_at > now()
  for update;

  if v_document.id is null then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;

  update public.document
  set status = 'failed',
      failure_reason = p_failure_reason,
      textract_job_id = coalesce(p_textract_job_id, v_document.textract_job_id)
  where id = p_document_id;

  insert into public.audit_event (
    workspace_id,
    actor_user_id,
    event_type,
    target_type,
    target_id,
    metadata
  )
  values (
    v_workspace_id,
    p_actor_user_id,
    'document.processing_failed',
    'document',
    p_document_id,
    jsonb_build_object(
      'failure_reason', p_failure_reason,
      'textract_job_id', p_textract_job_id,
      'request_id', p_request_id,
      'trace_id', p_trace_id
    )
  );

  document_id := p_document_id;
  status := 'failed';
  failure_reason := p_failure_reason;
  return next;
end;
$$;

revoke all on function public.claim_pending_document_upload_completion(
  uuid,
  uuid,
  text,
  text,
  text,
  inet,
  text
) from public;

revoke all on function public.claim_pending_document_upload_completion(
  uuid,
  uuid,
  text,
  text,
  text,
  inet,
  text
) from authenticated;

grant execute on function public.claim_pending_document_upload_completion(
  uuid,
  uuid,
  text,
  text,
  text,
  inet,
  text
) to service_role;

revoke all on function public.attach_document_textract_job(
  uuid,
  uuid,
  text,
  text,
  text
) from public;

revoke all on function public.attach_document_textract_job(
  uuid,
  uuid,
  text,
  text,
  text
) from authenticated;

grant execute on function public.attach_document_textract_job(
  uuid,
  uuid,
  text,
  text,
  text
) to service_role;

revoke all on function public.mark_document_processing_failed(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) from public;

revoke all on function public.mark_document_processing_failed(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) from authenticated;

grant execute on function public.mark_document_processing_failed(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) to service_role;
