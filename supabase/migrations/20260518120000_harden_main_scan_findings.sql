-- Harden findings from the full-main security scan without relying on
-- client-side table writes for service-owned document lifecycle state.

revoke insert on public.document from public;
revoke insert on public.document from anon;
revoke insert on public.document from authenticated;

drop policy if exists "document_workspace_insert" on public.document;

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
  int,
  text,
  text,
  text
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
  int,
  text,
  text,
  text
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
  int,
  text,
  text,
  text
) to service_role;

with active_originals as (
  select
    d.id,
    first_value(d.id) over (
      partition by d.workspace_id, d.file_sha256
      order by d.created_at, d.id
    ) as canonical_document_id,
    row_number() over (
      partition by d.workspace_id, d.file_sha256
      order by d.created_at, d.id
    ) as duplicate_rank
  from public.document d
  where d.file_sha256 is not null
    and d.deleted_at is null
    and d.status in ('pending','verified','processing','ready','failed')
    and d.duplicate_of_document_id is null
)
update public.document d
set
  duplicate_of_document_id = active_originals.canonical_document_id,
  duplicate_checked_at = coalesce(d.duplicate_checked_at, now()),
  duplicate_fingerprint = coalesce(
    d.duplicate_fingerprint,
    jsonb_build_object('file_sha256', d.file_sha256)
  )
from active_originals
where d.id = active_originals.id
  and active_originals.duplicate_rank > 1;

create unique index if not exists document_workspace_active_original_hash_uidx
  on public.document(workspace_id, file_sha256)
  where file_sha256 is not null
    and deleted_at is null
    and status in ('pending','verified','processing','ready','failed')
    and duplicate_of_document_id is null;

create or replace function public.reserve_document_conversion_credit(
  p_document_id uuid,
  p_actor_user_id uuid,
  p_cost_credits int,
  p_request_id text,
  p_trace_id text,
  p_actor_ip inet default null,
  p_actor_user_agent text default null
)
returns table(charge_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_role text;
  v_document record;
  v_current_balance int := 0;
  v_reserved_credits int := 0;
  v_available_credits int := 0;
  v_existing_status text;
  v_locked_workspace_id uuid;
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

  select w.id
  into v_locked_workspace_id
  from public.workspace w
  where w.id = v_workspace_id
  for update;

  if v_locked_workspace_id is null then
    raise exception 'workspace_not_found' using errcode = 'P0002';
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

  if v_document.status <> 'verified' then
    raise exception 'document_not_verified' using errcode = '23000';
  end if;

  if v_document.duplicate_of_document_id is not null then
    raise exception 'duplicate_document' using errcode = '23505';
  end if;

  if p_cost_credits <> v_document.conversion_cost_credits or p_cost_credits <> 1 then
    raise exception 'invalid_conversion_cost' using errcode = '22023';
  end if;

  select cr.status
  into v_existing_status
  from public.credit_reservation cr
  where cr.document_id = p_document_id
  for update;

  if v_existing_status = 'reserved' then
    update public.document
    set charge_status = 'reserved'
    where id = p_document_id;

    charge_status := 'reserved';
    return next;
    return;
  end if;

  if v_existing_status in ('consumed', 'released') then
    raise exception 'reservation_not_available' using errcode = '23000';
  end if;

  select coalesce(cl.balance_after, 0)
  into v_current_balance
  from public.credit_ledger cl
  where cl.workspace_id = v_workspace_id
  order by cl.created_at desc
  limit 1;

  select coalesce(sum(cr.credits), 0)
  into v_reserved_credits
  from public.credit_reservation cr
  where cr.workspace_id = v_workspace_id
    and cr.status = 'reserved';

  v_available_credits := coalesce(v_current_balance, 0) - coalesce(v_reserved_credits, 0);

  if v_available_credits < p_cost_credits then
    raise exception 'insufficient_balance' using errcode = '22003';
  end if;

  insert into public.credit_reservation (
    workspace_id,
    document_id,
    credits,
    status,
    reserved_by,
    request_id,
    trace_id
  )
  values (
    v_workspace_id,
    p_document_id,
    p_cost_credits,
    'reserved',
    p_actor_user_id,
    p_request_id,
    p_trace_id
  );

  update public.document
  set charge_status = 'reserved'
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
  values (
    v_workspace_id,
    p_actor_user_id,
    p_actor_ip,
    p_actor_user_agent,
    'credit.reserved',
    'document',
    p_document_id,
    jsonb_build_object(
      'credits', p_cost_credits,
      'available_before', v_available_credits,
      'request_id', p_request_id,
      'trace_id', p_trace_id
    )
  );

  charge_status := 'reserved';
  return next;
end;
$$;

revoke all on function public.reserve_document_conversion_credit(
  uuid,
  uuid,
  int,
  text,
  text,
  inet,
  text
) from public;
grant execute on function public.reserve_document_conversion_credit(
  uuid,
  uuid,
  int,
  text,
  text,
  inet,
  text
) to service_role;

create or replace function public.attest_ops_admin_access_review(
  p_review_id uuid,
  p_reviewer_user_id uuid,
  p_status text,
  p_review_note text,
  p_request_id text,
  p_trace_id text,
  p_actor_ip inet default null,
  p_actor_user_agent text default null
)
returns table(review_id uuid, status text, reviewed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('approved', 'changes_required') then
    raise exception 'invalid_access_review_status' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.ops_admin oa
    where oa.user_id = p_reviewer_user_id
      and oa.revoked_at is null
      and oa.role in ('owner', 'admin')
  ) then
    raise exception 'ops_admin_access_required' using errcode = '42501';
  end if;

  update public.ops_admin_access_review ar
  set
    status = p_status,
    reviewed_by = p_reviewer_user_id,
    reviewed_at = now(),
    review_note = nullif(p_review_note, '')
  where ar.id = p_review_id
    and ar.status = 'pending'
  returning ar.id, ar.status, ar.reviewed_at
  into review_id, status, reviewed_at;

  if review_id is null then
    raise exception 'access_review_not_found_or_already_attested' using errcode = 'P0002';
  end if;

  insert into public.audit_event (
    actor_user_id,
    actor_ip,
    actor_user_agent,
    event_type,
    target_type,
    target_id,
    metadata
  )
  values (
    p_reviewer_user_id,
    p_actor_ip,
    p_actor_user_agent,
    'ops_admin.access_review_attested',
    'ops_admin_access_review',
    review_id,
    jsonb_build_object(
      'status', status,
      'request_id', p_request_id,
      'trace_id', p_trace_id
    )
  );

  return next;
end;
$$;

revoke all on function public.attest_ops_admin_access_review(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  inet,
  text
) from public;
grant execute on function public.attest_ops_admin_access_review(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  inet,
  text
) to service_role;
