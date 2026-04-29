-- 0001_initial_schema.sql
-- PRIZM Phase 1 initial schema. Multi-tenant from day 1 (workspace_id everywhere) with single-workspace-per-user UI in Phase 1.
-- Reference: PRIZM/runs/2026-04-28-bankstatementconverter/report/FINAL_REPORT.md, ADR-003.

-- Required extensions.
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- workspace
-- Tenant boundary. Single row per signup in Phase 1. Phase 3 enables multi-row.
-- ============================================================
create table workspace (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_region text not null default 'us-east-1' check (default_region in ('us-east-1','eu-west-1')),
  created_at timestamptz not null default now()
);

create index workspace_created_at_idx on workspace(created_at);

-- ============================================================
-- user_profile
-- Extends Supabase auth.users with workspace + role + normalized email.
-- ============================================================
create table user_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspace(id) on delete cascade,
  email text not null,
  email_normalized text not null generated always as (lower(email)) stored,
  full_name text,
  role text not null default 'owner' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now()
);

create unique index user_profile_email_norm_idx on user_profile(email_normalized);
create index user_profile_workspace_idx on user_profile(workspace_id);

-- ============================================================
-- api_key
-- Scoped Bearer tokens. Hash stored, value shown once at creation.
-- ============================================================
create table api_key (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  user_id uuid not null references user_profile(id) on delete cascade,
  name text not null,
  scopes text[] not null check (scopes <@ array['upload','convert','read','admin']),
  key_hash text not null,
  key_prefix text not null,
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index api_key_workspace_idx on api_key(workspace_id);
create unique index api_key_hash_idx on api_key(key_hash);

-- ============================================================
-- document
-- Uploaded PDF metadata. S3 holds the binary.
-- ============================================================
create table document (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  uploaded_by uuid not null references user_profile(id),
  s3_bucket text not null,
  s3_key text not null,
  filename text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 50 * 1024 * 1024),
  content_type text not null check (content_type = 'application/pdf'),
  status text not null check (status in ('pending','processing','ready','failed','expired')),
  textract_job_id text,
  pages int,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  deleted_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index document_workspace_status_idx on document(workspace_id, status);
create index document_expires_idx on document(expires_at) where deleted_at is null;
create index document_textract_idx on document(textract_job_id) where textract_job_id is not null;

-- ============================================================
-- statement
-- Parsed output. Transactions inline as JSONB.
-- ============================================================
create table statement (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references document(id) on delete cascade,
  workspace_id uuid not null references workspace(id) on delete cascade,
  bank_name text,
  account_last4 text,
  period_start date,
  period_end date,
  opening_balance numeric(18,2),
  closing_balance numeric(18,2),
  reported_total numeric(18,2),
  computed_total numeric(18,2),
  reconciles boolean,
  transactions jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index statement_document_idx on statement(document_id);
create index statement_workspace_idx on statement(workspace_id);
create index statement_expires_idx on statement(expires_at) where deleted_at is null;

-- ============================================================
-- subscription
-- Mirror of Stripe subscription state, kept up to date by webhooks.
-- ============================================================
create table subscription (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  plan text not null check (plan in ('free','starter','pro')),
  billing_cycle text check (billing_cycle in ('monthly','annual')),
  status text not null check (status in ('trialing','active','past_due','canceled','incomplete')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscription_workspace_idx on subscription(workspace_id);
create unique index subscription_stripe_customer_idx on subscription(stripe_customer_id);

-- ============================================================
-- credit_ledger
-- Append-only record of credit grants and consumes.
-- ============================================================
create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('subscription_grant','overage_grant','conversion','manual_adjust','refund')),
  document_id uuid references document(id),
  stripe_invoice_id text,
  balance_after int not null,
  created_at timestamptz not null default now()
);

create index credit_ledger_workspace_created_idx on credit_ledger(workspace_id, created_at desc);

-- ============================================================
-- audit_event
-- Append-only log of security-relevant events. Server-side writes only.
-- ============================================================
create table audit_event (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspace(id),
  actor_user_id uuid references user_profile(id),
  actor_ip inet,
  actor_user_agent text,
  event_type text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_event_workspace_created_idx on audit_event(workspace_id, created_at desc);
create index audit_event_type_idx on audit_event(event_type);

-- ============================================================
-- Row Level Security policies
-- All domain tables enforce workspace membership. audit_event and credit_ledger
-- are server-side write-only via the service role.
-- ============================================================

alter table workspace enable row level security;
alter table user_profile enable row level security;
alter table api_key enable row level security;
alter table document enable row level security;
alter table statement enable row level security;
alter table subscription enable row level security;
alter table credit_ledger enable row level security;
alter table audit_event enable row level security;

-- Workspace policy: users see only their own workspace.
create policy "workspace_member_select" on workspace
  for select using (
    id in (select workspace_id from user_profile where id = auth.uid())
  );

create policy "workspace_owner_modify" on workspace
  for update using (
    id in (select workspace_id from user_profile where id = auth.uid() and role = 'owner')
  );

-- user_profile policy: users see members of their workspace.
create policy "user_profile_workspace_select" on user_profile
  for select using (
    workspace_id in (select workspace_id from user_profile up2 where up2.id = auth.uid())
  );

create policy "user_profile_self_update" on user_profile
  for update using (id = auth.uid());

-- api_key policy: workspace members see and manage their keys.
create policy "api_key_workspace_all" on api_key
  for all using (
    workspace_id in (
      select workspace_id from user_profile
      where id = auth.uid() and role in ('owner','admin')
    )
  );

-- document policy: workspace members read; owner/admin/member write.
create policy "document_workspace_select" on document
  for select using (
    workspace_id in (select workspace_id from user_profile where id = auth.uid())
  );

create policy "document_workspace_modify" on document
  for all using (
    workspace_id in (
      select workspace_id from user_profile
      where id = auth.uid() and role in ('owner','admin','member')
    )
  );

-- statement policy: same as document.
create policy "statement_workspace_select" on statement
  for select using (
    workspace_id in (select workspace_id from user_profile where id = auth.uid())
  );

create policy "statement_workspace_modify" on statement
  for all using (
    workspace_id in (
      select workspace_id from user_profile
      where id = auth.uid() and role in ('owner','admin','member')
    )
  );

-- subscription policy: workspace members read; only server-side service role writes.
create policy "subscription_workspace_select" on subscription
  for select using (
    workspace_id in (select workspace_id from user_profile where id = auth.uid())
  );

-- credit_ledger policy: workspace members read; only server-side writes.
create policy "credit_ledger_workspace_select" on credit_ledger
  for select using (
    workspace_id in (select workspace_id from user_profile where id = auth.uid())
  );

-- audit_event policy: only server-side reads via service role; no client access.
-- Client policy intentionally omitted, service role bypasses RLS.

-- ============================================================
-- updated_at trigger for subscription
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger subscription_set_updated_at
  before update on subscription
  for each row execute function set_updated_at();

-- ============================================================
-- Bootstrap: when a new auth.users row appears, create a workspace and user_profile.
-- ============================================================
create or replace function bootstrap_user_workspace()
returns trigger as $$
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
$$ language plpgsql security definer;

create trigger auth_user_bootstrap_workspace
  after insert on auth.users
  for each row execute function bootstrap_user_workspace();
