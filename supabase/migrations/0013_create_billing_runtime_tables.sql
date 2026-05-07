-- Billing runtime controls for Stripe webhook idempotency and period credit grants.

create table stripe_webhook_event (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null,
  event_type text not null,
  livemode boolean not null,
  status text not null default 'processing' check (status in ('processing','processed','failed')),
  error_code text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index stripe_webhook_event_stripe_id_idx
  on stripe_webhook_event(stripe_event_id);

create index stripe_webhook_event_status_created_idx
  on stripe_webhook_event(status, created_at desc);

alter table stripe_webhook_event enable row level security;

-- Webhook events are written by trusted server code only. No client RLS policy.

alter table credit_ledger
  add column billing_period_start timestamptz,
  add column billing_period_end timestamptz;

create unique index credit_ledger_subscription_grant_period_idx
  on credit_ledger(workspace_id, billing_period_start, billing_period_end)
  where reason = 'subscription_grant';
