-- 0002_fix_bootstrap_trigger.sql
-- Renames the auth.users bootstrap trigger to the conventional name on_auth_user_created.
-- Hardens bootstrap_user_workspace by pinning search_path and revoking client EXECUTE.
-- Closes the Supabase advisor warnings about mutable search_path and anon/authenticated EXECUTE.

-- Drop the old trigger by both possible names so this migration is idempotent.
drop trigger if exists auth_user_bootstrap_workspace on auth.users;
drop trigger if exists on_auth_user_created on auth.users;

-- Drop and recreate the function with a pinned search_path.
-- search_path = public, pg_temp prevents schema-resolution hijacking under SECURITY DEFINER.
drop function if exists public.bootstrap_user_workspace() cascade;

create function public.bootstrap_user_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_workspace_id uuid;
begin
  insert into workspace (name)
    values (coalesce(new.raw_user_meta_data->>'workspace_name', split_part(new.email, '@', 1) || '''s workspace'))
    returning id into new_workspace_id;

  insert into user_profile (id, workspace_id, email, full_name, role)
    values (
      new.id,
      new_workspace_id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', null),
      'owner'
    );

  return new;
end;
$$;

-- Lock down execution. Only the trigger context (postgres role) should invoke this.
revoke execute on function public.bootstrap_user_workspace() from public;
revoke execute on function public.bootstrap_user_workspace() from anon, authenticated;

-- Recreate the trigger under the conventional name.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.bootstrap_user_workspace();
