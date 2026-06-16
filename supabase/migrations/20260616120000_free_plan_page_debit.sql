-- Wires the post-extraction free-plan daily meter.
-- billablePageCount on the parsed statement (shipped in PR #86) is debited
-- here, exactly once per document, against the daily_usage row for that user
-- and day. Idempotence is enforced by a single document-level flag updated
-- in the same transaction as the meter upsert.

alter table public.document
  add column free_plan_pages_debited_at timestamptz;

comment on column public.document.free_plan_pages_debited_at is
  'Timestamp the free-plan daily page meter was debited for this document. NULL until debited. Set atomically inside debit_free_plan_pages_for_document so concurrent processing cannot double-charge.';

create or replace function public.debit_free_plan_pages_for_document(
  p_document_id uuid,
  p_user_id uuid,
  p_usage_date date,
  p_pages integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_claimed integer;
begin
  if p_pages is null or p_pages <= 0 then
    return null;
  end if;

  update public.document
  set free_plan_pages_debited_at = now()
  where id = p_document_id
    and free_plan_pages_debited_at is null;

  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    return null;
  end if;

  insert into public.daily_usage (user_id, usage_date, pages_used)
    values (p_user_id, p_usage_date, p_pages)
  on conflict (user_id, usage_date)
  do update set pages_used = public.daily_usage.pages_used + excluded.pages_used,
                updated_at = now()
  returning pages_used into v_total;

  return v_total;
end;
$$;

revoke all on function public.debit_free_plan_pages_for_document(uuid, uuid, date, integer) from public;
grant execute on function public.debit_free_plan_pages_for_document(uuid, uuid, date, integer) to service_role;
