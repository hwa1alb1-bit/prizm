-- Supabase advisor hardening: keep the service-owned statement review edit RPC
-- unavailable to browser client roles after the extended-signature replacement.

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

revoke execute on function public.update_statement_edit_if_current(
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
) from anon;

revoke execute on function public.update_statement_edit_if_current(
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
) from authenticated;

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
