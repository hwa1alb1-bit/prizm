-- Close advisor gaps surfaced after production drift migrations 0013-0015 were
-- applied and the first remediation migration was verified.

revoke all on function public.scrub_deleted_document(uuid, timestamptz) from public;
revoke execute on function public.scrub_deleted_document(uuid, timestamptz) from anon;
revoke execute on function public.scrub_deleted_document(uuid, timestamptz) from authenticated;
grant execute on function public.scrub_deleted_document(uuid, timestamptz) to service_role;

create index if not exists ops_admin_access_review_evidence_export_id_idx
  on public.ops_admin_access_review(evidence_export_id);

create index if not exists ops_admin_access_review_reviewed_by_idx
  on public.ops_admin_access_review(reviewed_by);

create index if not exists privacy_request_requested_by_idx
  on public.privacy_request(requested_by);

drop policy if exists "privacy_request_workspace_owner_select" on public.privacy_request;
create policy "privacy_request_workspace_owner_select" on public.privacy_request
  for select to authenticated
  using (
    workspace_id in (
      select workspace_id from public.user_profile
      where id = (select auth.uid()) and role in ('owner','admin')
    )
  );
