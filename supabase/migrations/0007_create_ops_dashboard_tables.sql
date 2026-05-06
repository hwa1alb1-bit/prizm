-- Phase 2 Ops Dashboard control-plane tables.
-- Provider data is server-read/server-write only. Admin authorization is a
-- separate ops_admin layer over Supabase Auth identity.

create table ops_admin (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profile(id) on delete cascade,
  role text not null check (role in ('owner','admin','viewer')),
  granted_by uuid references user_profile(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index ops_admin_active_user_idx
  on ops_admin(user_id)
  where revoked_at is null;

create index ops_admin_user_idx on ops_admin(user_id);

create table ops_provider (
  id text primary key,
  display_name text not null,
  category text not null,
  enabled boolean not null default true,
  console_url text not null,
  billing_url text,
  management_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ops_metric_config (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null references ops_provider(id),
  metric_key text not null,
  display_name text not null,
  unit text not null check (unit in ('requests','bytes','emails','events','connections','usd','status','count')),
  warning_threshold numeric not null default 0.70,
  critical_threshold numeric not null default 0.85,
  manual_limit numeric,
  required boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, metric_key)
);

create table ops_usage_snapshot (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null references ops_provider(id),
  metric_key text not null,
  display_name text not null,
  used numeric,
  limit_value numeric,
  unit text not null check (unit in ('requests','bytes','emails','events','connections','usd','status','count')),
  period_start timestamptz,
  period_end timestamptz,
  status text not null check (status in ('green','yellow','red','gray')),
  freshness text not null check (freshness in ('fresh','stale','failed')),
  source_url text,
  collected_at timestamptz not null default now(),
  error_code text,
  error_detail text,
  raw_ref jsonb
);

create index ops_usage_snapshot_latest_idx
  on ops_usage_snapshot(provider_id, metric_key, collected_at desc);

create index ops_usage_snapshot_status_idx
  on ops_usage_snapshot(status, collected_at desc);

create table ops_collection_run (
  id uuid primary key default gen_random_uuid(),
  provider_id text references ops_provider(id),
  trigger text not null check (trigger in ('cron','manual','deploy','test')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','ok','partial','failed')),
  metrics_count int not null default 0,
  error_detail text
);

create index ops_collection_run_provider_started_idx
  on ops_collection_run(provider_id, started_at desc);

alter table ops_admin enable row level security;
alter table ops_provider enable row level security;
alter table ops_metric_config enable row level security;
alter table ops_usage_snapshot enable row level security;
alter table ops_collection_run enable row level security;

create policy "ops_admin_self_select" on ops_admin
  for select using (user_id = auth.uid());

create trigger ops_provider_set_updated_at
  before update on ops_provider
  for each row execute function set_updated_at();

create trigger ops_metric_config_set_updated_at
  before update on ops_metric_config
  for each row execute function set_updated_at();

insert into ops_provider (id, display_name, category, console_url, billing_url, management_url)
values
  ('cloudflare', 'Cloudflare', 'edge', 'https://dash.cloudflare.com', 'https://dash.cloudflare.com/?to=/:account/billing', 'https://dash.cloudflare.com'),
  ('vercel', 'Vercel', 'hosting', 'https://vercel.com/dashboard', 'https://vercel.com/dashboard/usage', 'https://vercel.com/dashboard'),
  ('upstash', 'Upstash', 'rate-limit', 'https://console.upstash.com', 'https://console.upstash.com/account/billing', 'https://console.upstash.com'),
  ('supabase', 'Supabase', 'database', 'https://supabase.com/dashboard/projects', 'https://supabase.com/dashboard/org/_/billing', 'https://supabase.com/dashboard/projects'),
  ('sentry', 'Sentry', 'observability', 'https://sentry.io', 'https://sentry.io/settings/billing/', 'https://sentry.io'),
  ('resend', 'Resend', 'email', 'https://resend.com/emails', 'https://resend.com/settings/billing', 'https://resend.com/domains'),
  ('aws-mailboxes', 'AWS mailboxes', 'email', 'https://console.aws.amazon.com/ses/home', 'https://console.aws.amazon.com/billing/home', 'https://console.aws.amazon.com/ses/home'),
  ('stripe', 'Stripe', 'billing', 'https://dashboard.stripe.com', 'https://dashboard.stripe.com/settings/billing', 'https://dashboard.stripe.com/customers')
on conflict (id) do update set
  display_name = excluded.display_name,
  category = excluded.category,
  console_url = excluded.console_url,
  billing_url = excluded.billing_url,
  management_url = excluded.management_url;

insert into ops_metric_config (provider_id, metric_key, display_name, unit, required, sort_order)
select id, 'credential_gap', 'Missing credential count', 'count', true, 0
from ops_provider
on conflict (provider_id, metric_key) do nothing;

insert into ops_metric_config (provider_id, metric_key, display_name, unit, required, sort_order)
select id, 'usage_api', display_name || ' usage API', 'status', false, 10
from ops_provider
on conflict (provider_id, metric_key) do nothing;
