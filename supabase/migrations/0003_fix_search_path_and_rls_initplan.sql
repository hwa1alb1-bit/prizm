-- 0003_fix_search_path_and_rls_initplan.sql
-- Fix set_updated_at search_path (Supabase security advisor) and wrap auth.uid()
-- in (select auth.uid()) across all RLS policies (initplan optimization).

-- ============================================================
-- Fix set_updated_at: pin search_path
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================
-- RLS policy rewrites: wrap auth.uid() in (select auth.uid())
-- This converts per-row auth.uid() calls into a single initplan.
-- ============================================================

-- workspace
drop policy if exists "workspace_member_select" on workspace;
create policy "workspace_member_select" on workspace
  for select using (
    id in (select workspace_id from user_profile where id = (select auth.uid()))
  );

drop policy if exists "workspace_owner_modify" on workspace;
create policy "workspace_owner_modify" on workspace
  for update using (
    id in (select workspace_id from user_profile where id = (select auth.uid()) and role = 'owner')
  );

-- user_profile
drop policy if exists "user_profile_workspace_select" on user_profile;
create policy "user_profile_workspace_select" on user_profile
  for select using (
    workspace_id in (select workspace_id from user_profile up2 where up2.id = (select auth.uid()))
  );

drop policy if exists "user_profile_self_update" on user_profile;
create policy "user_profile_self_update" on user_profile
  for update using (id = (select auth.uid()));

-- api_key
drop policy if exists "api_key_workspace_all" on api_key;
create policy "api_key_workspace_all" on api_key
  for all using (
    workspace_id in (
      select workspace_id from user_profile
      where id = (select auth.uid()) and role in ('owner','admin')
    )
  );

-- document
drop policy if exists "document_workspace_select" on document;
create policy "document_workspace_select" on document
  for select using (
    workspace_id in (select workspace_id from user_profile where id = (select auth.uid()))
  );

drop policy if exists "document_workspace_modify" on document;
create policy "document_workspace_modify" on document
  for all using (
    workspace_id in (
      select workspace_id from user_profile
      where id = (select auth.uid()) and role in ('owner','admin','member')
    )
  );

-- statement
drop policy if exists "statement_workspace_select" on statement;
create policy "statement_workspace_select" on statement
  for select using (
    workspace_id in (select workspace_id from user_profile where id = (select auth.uid()))
  );

drop policy if exists "statement_workspace_modify" on statement;
create policy "statement_workspace_modify" on statement
  for all using (
    workspace_id in (
      select workspace_id from user_profile
      where id = (select auth.uid()) and role in ('owner','admin','member')
    )
  );

-- subscription
drop policy if exists "subscription_workspace_select" on subscription;
create policy "subscription_workspace_select" on subscription
  for select using (
    workspace_id in (select workspace_id from user_profile where id = (select auth.uid()))
  );

-- credit_ledger
drop policy if exists "credit_ledger_workspace_select" on credit_ledger;
create policy "credit_ledger_workspace_select" on credit_ledger
  for select using (
    workspace_id in (select workspace_id from user_profile where id = (select auth.uid()))
  );
