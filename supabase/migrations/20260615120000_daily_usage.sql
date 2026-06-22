-- Tracks per-day page usage for the free-plan 5-pages-per-day quota.
-- Paid plans continue to gate on credit_ledger (monthly credits).

create table public.daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  pages_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date),
  constraint daily_usage_pages_used_nonneg check (pages_used >= 0)
);

create index daily_usage_user_date_desc_idx on public.daily_usage (user_id, usage_date desc);

alter table public.daily_usage enable row level security;

-- Owner can read their own daily usage. Writes happen via service-role from
-- the conversion pipeline.
create policy daily_usage_owner_select on public.daily_usage
  for select using (auth.uid() = user_id);

comment on table public.daily_usage is
  'Free-plan daily upload counter. One row per (user, day). Server-side increments on each successful conversion.';

-- Atomic per-row increment so concurrent conversions cannot lose a count.
create or replace function public.increment_daily_usage(
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
begin
  insert into public.daily_usage (user_id, usage_date, pages_used)
    values (p_user_id, p_usage_date, p_pages)
  on conflict (user_id, usage_date)
  do update set pages_used = public.daily_usage.pages_used + excluded.pages_used,
                updated_at = now()
  returning pages_used into v_total;
  return v_total;
end;
$$;

revoke all on function public.increment_daily_usage(uuid, date, integer) from public;
grant execute on function public.increment_daily_usage(uuid, date, integer) to service_role;
