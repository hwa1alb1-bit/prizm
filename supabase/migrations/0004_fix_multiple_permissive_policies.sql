-- 0004_fix_multiple_permissive_policies.sql
-- Replace FOR ALL modify policies on document and statement with separate
-- INSERT/UPDATE/DELETE policies to avoid double-evaluation on SELECT.

-- document: drop the for-all modify policy, create insert/update/delete
drop policy if exists "document_workspace_modify" on document;

create policy "document_workspace_insert" on document
  for insert with check (
    workspace_id in (
      select workspace_id from user_profile
      where id = (select auth.uid()) and role in ('owner','admin','member')
    )
  );

create policy "document_workspace_update" on document
  for update using (
    workspace_id in (
      select workspace_id from user_profile
      where id = (select auth.uid()) and role in ('owner','admin','member')
    )
  );

create policy "document_workspace_delete" on document
  for delete using (
    workspace_id in (
      select workspace_id from user_profile
      where id = (select auth.uid()) and role in ('owner','admin','member')
    )
  );

-- statement: same treatment
drop policy if exists "statement_workspace_modify" on statement;

create policy "statement_workspace_insert" on statement
  for insert with check (
    workspace_id in (
      select workspace_id from user_profile
      where id = (select auth.uid()) and role in ('owner','admin','member')
    )
  );

create policy "statement_workspace_update" on statement
  for update using (
    workspace_id in (
      select workspace_id from user_profile
      where id = (select auth.uid()) and role in ('owner','admin','member')
    )
  );

create policy "statement_workspace_delete" on statement
  for delete using (
    workspace_id in (
      select workspace_id from user_profile
      where id = (select auth.uid()) and role in ('owner','admin','member')
    )
  );
