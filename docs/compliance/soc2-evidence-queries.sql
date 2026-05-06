-- SOC 2 evidence queries for PRIZM.
-- Replace :start_at and :end_at with the audit period bounds.
-- Replace :workspace_id only when sampling a specific customer workspace.

-- Audit completeness: security, privacy, billing, ops, provider, and deletion events.
select
  event_type,
  count(*) as event_count,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from audit_event
where created_at >= :start_at
  and created_at < :end_at
group by event_type
order by event_type;

-- Audit completeness sample with actor, target, and metadata for reviewer testing.
select
  id,
  workspace_id,
  actor_user_id,
  event_type,
  target_type,
  target_id,
  metadata,
  created_at
from audit_event
where created_at >= :start_at
  and created_at < :end_at
order by created_at desc
limit 100;

-- Deletion SLA: current health from monitor view.
select
  status,
  last_sweep_at,
  last_sweep_status,
  expired_survivors,
  receipt_failures
from deletion_health;

-- Deletion SLA: evidence for deleted or overdue documents.
select
  document_id,
  workspace_id,
  filename,
  expires_at,
  deleted_at,
  document_status,
  receipt_status,
  receipt_sent_at,
  receipt_error_code,
  deletion_audited_at
from deletion_evidence
where (
    expires_at >= :start_at
    and expires_at < :end_at
  )
  or (
    deleted_at >= :start_at
    and deleted_at < :end_at
  )
order by expires_at desc;

-- Provider health: latest snapshot per provider and metric.
with ranked_snapshots as (
  select
    ops_usage_snapshot.*,
    row_number() over (
      partition by provider_id, metric_key
      order by collected_at desc
    ) as snapshot_rank
  from ops_usage_snapshot
)
select
  provider_id,
  metric_key,
  display_name,
  used,
  limit_value,
  unit,
  status,
  freshness,
  collected_at,
  error_code,
  error_detail,
  source_url
from ranked_snapshots
where snapshot_rank = 1
order by provider_id, metric_key;

-- Provider health: cron/manual collection success rate.
select
  provider_id,
  trigger,
  status,
  count(*) as run_count,
  min(started_at) as first_started_at,
  max(started_at) as last_started_at,
  max(error_detail) filter (where status in ('partial', 'failed')) as latest_error_detail
from ops_collection_run
where started_at >= :start_at
  and started_at < :end_at
group by provider_id, trigger, status
order by provider_id nulls first, trigger, status;

-- Admin access review: active and revoked ops dashboard access.
select
  oa.id,
  oa.user_id,
  up.email,
  up.workspace_id,
  oa.role,
  oa.granted_by,
  oa.created_at,
  oa.revoked_at
from ops_admin oa
join user_profile up on up.id = oa.user_id
order by oa.revoked_at nulls first, oa.created_at desc;

-- Admin access review: dashboard access and provider drilldown activity.
select
  actor_user_id,
  event_type,
  count(*) as event_count,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from audit_event
where event_type in (
    'ops.admin_login',
    'ops.dashboard_read',
    'ops.provider_drilldown_read',
    'ops.provider_refresh_requested',
    'ops.quick_link_clicked'
  )
  and created_at >= :start_at
  and created_at < :end_at
group by actor_user_id, event_type
order by actor_user_id, event_type;

-- Billing controls: Stripe webhook audit trail.
select
  id,
  event_type,
  metadata->>'stripe_event_id' as stripe_event_id,
  metadata->>'type' as stripe_event_type,
  metadata->>'livemode' as livemode,
  metadata->>'request_id' as request_id,
  metadata->>'trace_id' as trace_id,
  created_at
from audit_event
where event_type like 'stripe.%'
  and created_at >= :start_at
  and created_at < :end_at
order by created_at desc;

-- Billing controls: subscription mirror and credit ledger reconciliation sample.
select
  s.workspace_id,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  s.plan,
  s.billing_cycle,
  s.status,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  coalesce(sum(cl.delta), 0) as credit_delta_in_period
from subscription s
left join credit_ledger cl
  on cl.workspace_id = s.workspace_id
  and cl.created_at >= :start_at
  and cl.created_at < :end_at
group by
  s.workspace_id,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  s.plan,
  s.billing_cycle,
  s.status,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end
order by s.workspace_id;

-- Privacy request workflow: SAR and account deletion queue health.
select
  request_type,
  status,
  count(*) as request_count,
  min(created_at) as oldest_created_at,
  min(due_at) filter (where status in ('received', 'processing')) as next_open_due_at,
  count(*) filter (
    where status in ('received', 'processing')
      and due_at < now()
  ) as overdue_open_count
from privacy_request
where created_at >= :start_at
  and created_at < :end_at
group by request_type, status
order by request_type, status;

-- Privacy request workflow: detailed sample for auditor traceability.
select
  pr.id,
  pr.workspace_id,
  pr.requested_by,
  up.email as requested_by_email,
  pr.request_type,
  pr.status,
  pr.due_at,
  pr.completed_at,
  pr.rejected_reason,
  pr.created_at,
  pr.updated_at,
  ae.id as request_audit_event_id,
  ae.created_at as request_audited_at
from privacy_request pr
join user_profile up on up.id = pr.requested_by
left join audit_event ae
  on ae.target_type = 'privacy_request'
  and ae.target_id = pr.id
  and ae.event_type = case
    when pr.request_type = 'data_export' then 'privacy.data_export.requested'
    when pr.request_type = 'account_deletion' then 'privacy.account_deletion.requested'
  end
where pr.created_at >= :start_at
  and pr.created_at < :end_at
order by pr.created_at desc;
