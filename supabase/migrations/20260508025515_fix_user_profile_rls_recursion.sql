-- Fix recursive RLS policies that read public.user_profile while evaluating
-- public.user_profile, and route workspace/role lookups through private
-- SECURITY DEFINER helpers instead.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.current_user_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select up.workspace_id
  from public.user_profile as up
  where up.id = (select auth.uid())
$$;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select up.role
  from public.user_profile as up
  where up.id = (select auth.uid())
$$;

revoke all on function private.current_user_workspace_id() from public;
revoke all on function private.current_user_role() from public;
grant execute on function private.current_user_workspace_id() to authenticated, service_role;
grant execute on function private.current_user_role() to authenticated, service_role;

-- workspace
drop policy if exists "workspace_member_select" on workspace;
create policy "workspace_member_select" on workspace
  for select to authenticated using (
    id = (select private.current_user_workspace_id())
  );

drop policy if exists "workspace_owner_modify" on workspace;
create policy "workspace_owner_modify" on workspace
  for update to authenticated using (
    id = (select private.current_user_workspace_id())
    and (select private.current_user_role()) = 'owner'
  )
  with check (
    id = (select private.current_user_workspace_id())
    and (select private.current_user_role()) = 'owner'
  );

-- user_profile
drop policy if exists "user_profile_workspace_select" on user_profile;
create policy "user_profile_workspace_select" on user_profile
  for select to authenticated using (
    workspace_id = (select private.current_user_workspace_id())
  );

drop policy if exists "user_profile_self_update" on user_profile;
create policy "user_profile_self_update" on user_profile
  for update to authenticated using (
    id = (select auth.uid())
  )
  with check (
    id = (select auth.uid())
    and workspace_id = (select private.current_user_workspace_id())
    and role = (select private.current_user_role())
  );

-- api_key
drop policy if exists "api_key_workspace_all" on api_key;
create policy "api_key_workspace_all" on api_key
  for all to authenticated using (
    workspace_id = (select private.current_user_workspace_id())
    and (select private.current_user_role()) in ('owner', 'admin')
  )
  with check (
    workspace_id = (select private.current_user_workspace_id())
    and (select private.current_user_role()) in ('owner', 'admin')
  );

-- document
drop policy if exists "document_workspace_modify" on document;
drop policy if exists "document_workspace_select" on document;
create policy "document_workspace_select" on document
  for select to authenticated using (
    workspace_id = (select private.current_user_workspace_id())
  );

drop policy if exists "document_workspace_insert" on document;
create policy "document_workspace_insert" on document
  for insert to authenticated with check (
    workspace_id = (select private.current_user_workspace_id())
    and (select private.current_user_role()) in ('owner', 'admin', 'member')
  );

drop policy if exists "document_workspace_update" on document;
create policy "document_workspace_update" on document
  for update to authenticated using (
    workspace_id = (select private.current_user_workspace_id())
    and (select private.current_user_role()) in ('owner', 'admin', 'member')
  )
  with check (
    workspace_id = (select private.current_user_workspace_id())
    and (select private.current_user_role()) in ('owner', 'admin', 'member')
  );

drop policy if exists "document_workspace_delete" on document;
create policy "document_workspace_delete" on document
  for delete to authenticated using (
    workspace_id = (select private.current_user_workspace_id())
    and (select private.current_user_role()) in ('owner', 'admin', 'member')
  );

-- statement
drop policy if exists "statement_workspace_modify" on statement;
drop policy if exists "statement_workspace_select" on statement;
create policy "statement_workspace_select" on statement
  for select to authenticated using (
    workspace_id = (select private.current_user_workspace_id())
  );

drop policy if exists "statement_workspace_insert" on statement;
create policy "statement_workspace_insert" on statement
  for insert to authenticated with check (
    workspace_id = (select private.current_user_workspace_id())
    and (select private.current_user_role()) in ('owner', 'admin', 'member')
  );

drop policy if exists "statement_workspace_update" on statement;
create policy "statement_workspace_update" on statement
  for update to authenticated using (
    workspace_id = (select private.current_user_workspace_id())
    and (select private.current_user_role()) in ('owner', 'admin', 'member')
  )
  with check (
    workspace_id = (select private.current_user_workspace_id())
    and (select private.current_user_role()) in ('owner', 'admin', 'member')
  );

drop policy if exists "statement_workspace_delete" on statement;
create policy "statement_workspace_delete" on statement
  for delete to authenticated using (
    workspace_id = (select private.current_user_workspace_id())
    and (select private.current_user_role()) in ('owner', 'admin', 'member')
  );

-- subscription
drop policy if exists "subscription_workspace_select" on subscription;
create policy "subscription_workspace_select" on subscription
  for select to authenticated using (
    workspace_id = (select private.current_user_workspace_id())
  );

-- credit_ledger
drop policy if exists "credit_ledger_workspace_select" on credit_ledger;
create policy "credit_ledger_workspace_select" on credit_ledger
  for select to authenticated using (
    workspace_id = (select private.current_user_workspace_id())
  );

-- credit_reservation
drop policy if exists "credit_reservation_workspace_select" on credit_reservation;
create policy "credit_reservation_workspace_select" on credit_reservation
  for select to authenticated using (
    workspace_id = (select private.current_user_workspace_id())
  );

-- export_artifact
drop policy if exists "export_artifact_workspace_select" on export_artifact;
create policy "export_artifact_workspace_select" on export_artifact
  for select to authenticated using (
    workspace_id = (select private.current_user_workspace_id())
  );

-- extraction_report
drop policy if exists "extraction_report_workspace_select" on extraction_report;
create policy "extraction_report_workspace_select" on extraction_report
  for select to authenticated using (
    workspace_id = (select private.current_user_workspace_id())
  );

-- privacy_request
do $$
begin
  if to_regclass('public.privacy_request') is not null then
    drop policy if exists "privacy_request_workspace_owner_select" on privacy_request;
    create policy "privacy_request_workspace_owner_select" on privacy_request
      for select to authenticated using (
        workspace_id = (select private.current_user_workspace_id())
        and (select private.current_user_role()) in ('owner', 'admin')
      );
  end if;
end $$;
