-- Harden the lean conversion lifecycle after 0009.
-- Adds deployable credit reservation RPCs and removes the pre-hash upload RPC
-- overload left behind by 0006.

drop function if exists public.create_pending_document_upload(
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
);

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

create or replace function public.consume_document_conversion_credit(
  p_document_id uuid,
  p_consumed_at timestamptz
)
returns table(charge_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation record;
  v_current_balance int := 0;
  v_next_balance int := 0;
  v_locked_workspace_id uuid;
begin
  select cr.*
  into v_reservation
  from public.credit_reservation cr
  where cr.document_id = p_document_id
  for update;

  if v_reservation.id is null then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  select w.id
  into v_locked_workspace_id
  from public.workspace w
  where w.id = v_reservation.workspace_id
  for update;

  if v_locked_workspace_id is null then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  if v_reservation.status = 'consumed' then
    charge_status := 'consumed';
    return next;
    return;
  end if;

  if v_reservation.status <> 'reserved' then
    raise exception 'reservation_not_reserved' using errcode = '23000';
  end if;

  select coalesce(cl.balance_after, 0)
  into v_current_balance
  from public.credit_ledger cl
  where cl.workspace_id = v_reservation.workspace_id
  order by cl.created_at desc
  limit 1;

  v_next_balance := coalesce(v_current_balance, 0) - v_reservation.credits;

  update public.credit_reservation
  set
    status = 'consumed',
    consumed_at = p_consumed_at
  where id = v_reservation.id;

  update public.document
  set charge_status = 'consumed'
  where id = p_document_id;

  insert into public.credit_ledger (
    workspace_id,
    delta,
    reason,
    document_id,
    balance_after
  )
  values (
    v_reservation.workspace_id,
    -v_reservation.credits,
    'conversion',
    p_document_id,
    v_next_balance
  );

  charge_status := 'consumed';
  return next;
end;
$$;

create or replace function public.release_document_conversion_credit(
  p_document_id uuid,
  p_released_at timestamptz
)
returns table(charge_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation record;
  v_locked_workspace_id uuid;
begin
  select cr.*
  into v_reservation
  from public.credit_reservation cr
  where cr.document_id = p_document_id
  for update;

  if v_reservation.id is null then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  select w.id
  into v_locked_workspace_id
  from public.workspace w
  where w.id = v_reservation.workspace_id
  for update;

  if v_locked_workspace_id is null then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  if v_reservation.status = 'released' then
    charge_status := 'released';
    return next;
    return;
  end if;

  if v_reservation.status = 'consumed' then
    raise exception 'reservation_already_consumed' using errcode = '23000';
  end if;

  update public.credit_reservation
  set
    status = 'released',
    released_at = p_released_at
  where id = v_reservation.id;

  update public.document
  set charge_status = 'released'
  where id = p_document_id;

  charge_status := 'released';
  return next;
end;
$$;

create or replace function public.update_statement_edit_if_current(
  p_statement_id uuid,
  p_workspace_id uuid,
  p_document_id uuid,
  p_expected_revision int,
  p_transactions jsonb,
  p_revision int,
  p_review_status text,
  p_edited_by uuid,
  p_edited_at timestamptz
)
returns table(updated boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count int := 0;
begin
  if p_review_status not in ('unreviewed', 'reviewed') then
    raise exception 'invalid_review_status' using errcode = '22023';
  end if;

  update public.statement s
  set
    transactions = p_transactions,
    revision = p_revision,
    review_status = p_review_status,
    edited_by = p_edited_by,
    edited_at = p_edited_at
  from public.document d
  where s.id = p_statement_id
    and s.workspace_id = p_workspace_id
    and s.document_id = p_document_id
    and s.revision = p_expected_revision
    and s.deleted_at is null
    and s.expires_at > now()
    and d.id = s.document_id
    and d.workspace_id = p_workspace_id
    and d.status = 'ready'
    and d.deleted_at is null
    and d.expires_at > now();

  get diagnostics v_updated_count = row_count;
  updated := v_updated_count = 1;
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

revoke all on function public.consume_document_conversion_credit(uuid, timestamptz) from public;
revoke all on function public.release_document_conversion_credit(uuid, timestamptz) from public;

grant execute on function public.consume_document_conversion_credit(uuid, timestamptz)
to service_role;

grant execute on function public.release_document_conversion_credit(uuid, timestamptz)
to service_role;

revoke all on function public.update_statement_edit_if_current(
  uuid,
  uuid,
  uuid,
  int,
  jsonb,
  int,
  text,
  uuid,
  timestamptz
) from public;

grant execute on function public.update_statement_edit_if_current(
  uuid,
  uuid,
  uuid,
  int,
  jsonb,
  int,
  text,
  uuid,
  timestamptz
) to service_role;
