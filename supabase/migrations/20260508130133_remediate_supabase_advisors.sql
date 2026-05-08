-- Remediate Supabase advisor findings for exposed SECURITY DEFINER functions,
-- deletion views, service-only operational tables, and missing FK indexes.

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
  p_conversion_cost_credits int default 1
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
begin
  if p_actor_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if auth.uid() is not null and auth.uid() <> p_actor_user_id then
    raise exception 'actor_mismatch' using errcode = '42501';
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

create or replace function public.create_privacy_request_for_actor(
  p_actor_user_id uuid,
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
  v_workspace_id uuid;
  v_role text;
  v_privacy_request_id uuid;
  v_status text := 'received';
begin
  if p_actor_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if auth.uid() is not null and auth.uid() <> p_actor_user_id then
    raise exception 'actor_mismatch' using errcode = '42501';
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
  where up.id = p_actor_user_id;

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
    p_actor_user_id,
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
    p_actor_user_id,
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
  int
) from public;
revoke execute on function public.create_pending_document_upload_for_actor(
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
) from anon;
revoke execute on function public.create_pending_document_upload_for_actor(
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
) from authenticated;
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
  int
) to service_role;

revoke all on function public.create_privacy_request_for_actor(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text,
  inet,
  text
) from public;
revoke execute on function public.create_privacy_request_for_actor(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text,
  inet,
  text
) from anon;
revoke execute on function public.create_privacy_request_for_actor(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text,
  inet,
  text
) from authenticated;
grant execute on function public.create_privacy_request_for_actor(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text,
  inet,
  text
) to service_role;

revoke execute on function public.create_pending_document_upload(
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
) from anon;
revoke execute on function public.create_pending_document_upload(
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
) from authenticated;

revoke execute on function public.create_privacy_request(
  text,
  text,
  timestamptz,
  text,
  text,
  inet,
  text
) from anon;
revoke execute on function public.create_privacy_request(
  text,
  text,
  timestamptz,
  text,
  text,
  inet,
  text
) from authenticated;

revoke execute on function public.reserve_document_conversion_credit(
  uuid,
  uuid,
  int,
  text,
  text,
  inet,
  text
) from anon;
revoke execute on function public.reserve_document_conversion_credit(
  uuid,
  uuid,
  int,
  text,
  text,
  inet,
  text
) from authenticated;

revoke execute on function public.consume_document_conversion_credit(uuid, timestamptz) from anon;
revoke execute on function public.consume_document_conversion_credit(uuid, timestamptz) from authenticated;
revoke execute on function public.release_document_conversion_credit(uuid, timestamptz) from anon;
revoke execute on function public.release_document_conversion_credit(uuid, timestamptz) from authenticated;
revoke execute on function public.scrub_deleted_document(uuid, timestamptz) from anon;
revoke execute on function public.scrub_deleted_document(uuid, timestamptz) from authenticated;

revoke execute on function public.update_statement_edit_if_current(
  uuid,
  uuid,
  uuid,
  int,
  jsonb,
  int,
  text,
  uuid,
  timestamptz
) from anon;
revoke execute on function public.update_statement_edit_if_current(
  uuid,
  uuid,
  uuid,
  int,
  jsonb,
  int,
  text,
  uuid,
  timestamptz
) from authenticated;

revoke execute on function public.get_soc2_audit_event_counts(timestamptz, timestamptz) from anon;
revoke execute on function public.get_soc2_audit_event_counts(timestamptz, timestamptz) from authenticated;

revoke execute on function public.open_ops_admin_access_review(
  timestamptz,
  timestamptz,
  timestamptz,
  jsonb,
  int,
  int,
  int,
  uuid,
  text
) from anon;
revoke execute on function public.open_ops_admin_access_review(
  timestamptz,
  timestamptz,
  timestamptz,
  jsonb,
  int,
  int,
  int,
  uuid,
  text
) from authenticated;

revoke execute on function public.create_soc2_evidence_export(
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  jsonb,
  int,
  int,
  jsonb,
  int,
  int,
  int,
  text
) from anon;
revoke execute on function public.create_soc2_evidence_export(
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  jsonb,
  int,
  int,
  jsonb,
  int,
  int,
  int,
  text
) from authenticated;

revoke execute on function public.attest_ops_admin_access_review(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  inet,
  text
) from anon;
revoke execute on function public.attest_ops_admin_access_review(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  inet,
  text
) from authenticated;

create or replace view public.deletion_evidence with (security_invoker = true) as
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
from public.document d
left join public.deletion_receipt dr on dr.document_id = d.id
left join public.audit_event ae
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

create or replace view public.deletion_health with (security_invoker = true) as
with latest_run as (
  select *
  from public.deletion_sweep_run
  order by started_at desc
  limit 1
),
document_survivors as (
  select count(*)::int as count
  from public.document
  where expires_at < now() - interval '5 minutes'
    and deleted_at is null
),
statement_survivors as (
  select count(*)::int as count
  from public.statement
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

revoke all on table public.deletion_evidence from anon;
revoke all on table public.deletion_evidence from authenticated;
revoke all on table public.deletion_health from anon;
revoke all on table public.deletion_health from authenticated;
grant select on table public.deletion_evidence to service_role;
grant select on table public.deletion_health to service_role;

alter table public.audit_event enable row level security;
alter table public.deletion_receipt enable row level security;
alter table public.deletion_sweep_run enable row level security;
alter table public.ops_collection_run enable row level security;
alter table public.ops_metric_config enable row level security;
alter table public.ops_provider enable row level security;
alter table public.ops_usage_snapshot enable row level security;
alter table public.stripe_webhook_event enable row level security;
alter table public.soc2_evidence_export enable row level security;
alter table public.ops_admin_access_review enable row level security;

drop policy if exists "audit_event_no_client_access" on public.audit_event;
create policy "audit_event_no_client_access" on public.audit_event
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "deletion_receipt_no_client_access" on public.deletion_receipt;
create policy "deletion_receipt_no_client_access" on public.deletion_receipt
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "deletion_sweep_run_no_client_access" on public.deletion_sweep_run;
create policy "deletion_sweep_run_no_client_access" on public.deletion_sweep_run
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "ops_collection_run_no_client_access" on public.ops_collection_run;
create policy "ops_collection_run_no_client_access" on public.ops_collection_run
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "ops_metric_config_no_client_access" on public.ops_metric_config;
create policy "ops_metric_config_no_client_access" on public.ops_metric_config
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "ops_provider_no_client_access" on public.ops_provider;
create policy "ops_provider_no_client_access" on public.ops_provider
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "ops_usage_snapshot_no_client_access" on public.ops_usage_snapshot;
create policy "ops_usage_snapshot_no_client_access" on public.ops_usage_snapshot
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "stripe_webhook_event_no_client_access" on public.stripe_webhook_event;
create policy "stripe_webhook_event_no_client_access" on public.stripe_webhook_event
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "soc2_evidence_export_no_client_access" on public.soc2_evidence_export;
create policy "soc2_evidence_export_no_client_access" on public.soc2_evidence_export
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "ops_admin_access_review_no_client_access" on public.ops_admin_access_review;
create policy "ops_admin_access_review_no_client_access" on public.ops_admin_access_review
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "ops_admin_self_select" on public.ops_admin;
create policy "ops_admin_self_select" on public.ops_admin
  for select to authenticated
  using (user_id = (select auth.uid()));

create index if not exists credit_reservation_reserved_by_idx
  on public.credit_reservation(reserved_by);

create index if not exists deletion_receipt_recipient_user_id_idx
  on public.deletion_receipt(recipient_user_id);

create index if not exists export_artifact_created_by_idx
  on public.export_artifact(created_by);

create index if not exists export_artifact_statement_id_idx
  on public.export_artifact(statement_id);

create index if not exists extraction_report_reported_by_idx
  on public.extraction_report(reported_by);

create index if not exists extraction_report_statement_id_idx
  on public.extraction_report(statement_id);

create index if not exists extraction_report_workspace_id_idx
  on public.extraction_report(workspace_id);

create index if not exists ops_admin_granted_by_idx
  on public.ops_admin(granted_by);

create index if not exists statement_edited_by_idx
  on public.statement(edited_by);
