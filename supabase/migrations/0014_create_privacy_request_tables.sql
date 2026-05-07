-- Phase 6 Compliance and Trust Surface.
-- Privacy requests are workflow records, not immediate destructive mutations.
-- Route handlers call create_privacy_request through a user-scoped Supabase
-- client so the request row and audit_event row are written atomically.

create table privacy_request (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  requested_by uuid not null references user_profile(id),
  request_type text not null check (request_type in ('data_export','account_deletion')),
  status text not null check (status in ('received','processing','completed','rejected')),
  due_at timestamptz not null,
  completed_at timestamptz,
  rejected_reason text,
  actor_ip inet,
  actor_user_agent text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index privacy_request_workspace_created_idx
  on privacy_request(workspace_id, created_at desc);

create index privacy_request_status_due_idx
  on privacy_request(status, due_at);

alter table privacy_request enable row level security;

create policy "privacy_request_workspace_owner_select" on privacy_request
  for select using (
    workspace_id in (
      select workspace_id from user_profile
      where id = auth.uid() and role in ('owner','admin')
    )
  );

create trigger privacy_request_set_updated_at
  before update on privacy_request
  for each row execute function set_updated_at();

create or replace function public.create_privacy_request(
  p_request_type text,
  p_audit_event_type text,
  p_due_at timestamptz,
  p_request_id text,
  p_trace_id text,
  p_actor_ip inet default null,
  p_actor_user_agent text default null
)
returns table(privacy_request_id uuid, request_type text, status text, due_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_role text;
  v_privacy_request_id uuid;
  v_status text := 'received';
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_request_type not in ('data_export', 'account_deletion') then
    raise exception 'invalid_privacy_request_type' using errcode = '22023';
  end if;

  if p_request_type = 'data_export' and p_audit_event_type <> 'privacy.data_export.requested' then
    raise exception 'invalid_privacy_request_type' using errcode = '22023';
  end if;

  if p_request_type = 'account_deletion' and p_audit_event_type <> 'privacy.account_deletion.requested' then
    raise exception 'invalid_privacy_request_type' using errcode = '22023';
  end if;

  select up.workspace_id, up.role
  into v_workspace_id, v_role
  from public.user_profile up
  where up.id = v_user_id;

  if v_workspace_id is null then
    raise exception 'workspace_profile_not_found' using errcode = '42501';
  end if;

  if v_role not in ('owner', 'admin') then
    raise exception 'workspace_write_forbidden' using errcode = '42501';
  end if;

  insert into public.privacy_request (
    workspace_id,
    requested_by,
    request_type,
    status,
    due_at,
    actor_ip,
    actor_user_agent,
    metadata
  )
  values (
    v_workspace_id,
    v_user_id,
    p_request_type,
    v_status,
    p_due_at,
    p_actor_ip,
    p_actor_user_agent,
    jsonb_build_object(
      'request_id', p_request_id,
      'trace_id', p_trace_id
    )
  )
  returning id into v_privacy_request_id;

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
    p_audit_event_type,
    'privacy_request',
    v_privacy_request_id,
    jsonb_build_object(
      'request_type', p_request_type,
      'status', v_status,
      'due_at', p_due_at,
      'request_id', p_request_id,
      'trace_id', p_trace_id
    )
  );

  privacy_request_id := v_privacy_request_id;
  request_type := p_request_type;
  status := v_status;
  due_at := p_due_at;
  return next;
end;
$$;

revoke all on function public.create_privacy_request(
  text,
  text,
  timestamptz,
  text,
  text,
  inet,
  text
) from public;

grant execute on function public.create_privacy_request(
  text,
  text,
  timestamptz,
  text,
  text,
  inet,
  text
) to authenticated;
