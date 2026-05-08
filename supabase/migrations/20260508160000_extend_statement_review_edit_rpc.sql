create or replace function public.update_statement_edit_if_current(
  p_statement_id uuid,
  p_workspace_id uuid,
  p_document_id uuid,
  p_expected_revision int,
  p_statement_type text,
  p_statement_metadata jsonb,
  p_bank_name text,
  p_account_last4 text,
  p_period_start date,
  p_period_end date,
  p_opening_balance numeric,
  p_closing_balance numeric,
  p_reported_total numeric,
  p_computed_total numeric,
  p_reconciles boolean,
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
  if p_statement_type not in ('bank', 'credit_card') then
    raise exception 'invalid_statement_type' using errcode = '22023';
  end if;

  if p_review_status not in ('unreviewed', 'reviewed') then
    raise exception 'invalid_review_status' using errcode = '22023';
  end if;

  update public.statement s
  set
    statement_type = p_statement_type,
    statement_metadata = coalesce(p_statement_metadata, '{}'::jsonb),
    bank_name = p_bank_name,
    account_last4 = p_account_last4,
    period_start = p_period_start,
    period_end = p_period_end,
    opening_balance = p_opening_balance,
    closing_balance = p_closing_balance,
    reported_total = p_reported_total,
    computed_total = p_computed_total,
    reconciles = p_reconciles,
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

revoke all on function public.update_statement_edit_if_current(
  uuid,
  uuid,
  uuid,
  int,
  text,
  jsonb,
  text,
  text,
  date,
  date,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean,
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
  text,
  jsonb,
  text,
  text,
  date,
  date,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean,
  jsonb,
  int,
  text,
  uuid,
  timestamptz
) to service_role;
