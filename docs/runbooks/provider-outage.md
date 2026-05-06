# Provider Outage Runbook

## Owner

Primary: Operations owner. Backup: Engineering lead responsible for provider integrations.

## Severity

Sev 1 when the outage blocks authentication, database reads/writes, document conversion, billing, or deletion compliance for all users. Sev 2 when one provider or plan tier is materially degraded. Sev 3 when degradation is visible only in internal telemetry.

## Detection

- `ops_usage_snapshot.status` is red or gray for a required provider metric.
- `/api/ops/collect` or `/api/ops/collect/[provider]` records `ops_collection_run.status` as failed or partial.
- `audit_event` includes `ops.provider_collection_failed`.
- Sentry, Vercel, Supabase, AWS, Stripe, Resend, Upstash, Cloudflare, or other provider status pages show an active incident.
- User reports mention failed upload, conversion, login, webhook, email, or dashboard access.

## Response

First 15 minutes:

1. Identify the affected provider ID from `ops_provider` and latest `ops_usage_snapshot`.
2. Confirm provider status from the vendor console and public status page.
3. Determine customer-facing impact: upload, conversion, billing, email, admin dashboard, deletion sweep, or privacy request workflow.
4. Stop automated retries if they risk quota burn or duplicate side effects.
5. Open a timeline and assign one person to monitor provider recovery.

User comms:

- For user-visible degradation, publish a short status update naming the affected workflow, not internal implementation details.
- For compliance-impacting provider outages, include whether deletion sweep, monitor, or privacy request due dates are affected.

Evidence to collect:

- Latest `ops_collection_run` rows for the provider.
- Latest `ops_usage_snapshot` rows including `status`, `freshness`, `error_code`, `error_detail`, and `source_url`.
- Provider status page incident URL and screenshots.
- Representative request IDs, trace IDs, and Sentry issues.

Expected audit events:

- `ops.provider_collection_failed`
- `ops.provider_refresh_requested` for manual rechecks
- `ops.dashboard_read` and `ops.provider_drilldown_read` during investigation

## Verification

- Required provider metrics return green or a documented manual control is active.
- A fresh `ops_collection_run` completes with status `ok` after provider recovery.
- Failed user workflow is manually tested with one known-good account.
- Any delayed deletion, privacy, billing, or conversion work is replayed or queued with owner and deadline.
