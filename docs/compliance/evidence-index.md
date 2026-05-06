# SOC 2 Evidence Index

This index maps controls to production evidence sources. Evidence exports should use read-only or service-role controlled access and should preserve query text, timestamp, requester, and output hash.

## Core Tables

- `audit_event`: security, privacy, billing, provider dashboard, webhook, deletion, and admin activity evidence.
- `document`: uploaded PDF metadata, status, expiry, deletion timestamp, and Textract job IDs.
- `statement`: extracted output, expiry, deletion timestamp, and workspace linkage.
- `subscription`: Stripe subscription mirror for billing controls.
- `credit_ledger`: append-only credit grants, consumption, refunds, and manual adjustments.
- `ops_admin`: internal operations dashboard access review.
- `ops_provider`: provider inventory backing the ops dashboard.
- `ops_usage_snapshot`: provider health, usage, quota, and freshness evidence.
- `ops_collection_run`: provider collection execution history.
- `deletion_sweep_run`: deletion cron execution and outcome counts.
- `deletion_receipt`: deletion notification delivery evidence.
- `deletion_evidence`: view joining documents, receipts, and deletion audit events.
- `deletion_health`: view summarizing deletion SLA health.
- `privacy_request`: SAR and account deletion workflow record.

## Evidence Areas

Audit completeness:

- Use `audit_event` to prove security-relevant events are recorded with workspace, actor, target, metadata, and timestamp.
- Include event types for ops access, privacy requests, deletion, provider collection, and Stripe webhooks.

Deletion SLA:

- Use `deletion_health`, `deletion_evidence`, `deletion_sweep_run`, and `deletion_receipt`.
- Verify no expired document or statement remains undeleted beyond the monitor grace period.

Provider health:

- Use `ops_usage_snapshot` for status/freshness and `ops_collection_run` for cron/manual collection history.
- Vercel cron runs `/api/ops/collect` every 10 minutes.

Admin access review:

- Use `ops_admin` active rows and `audit_event` entries for `ops.admin_login`, `ops.dashboard_read`, and provider drilldowns.
- Confirm revoked administrators have `revoked_at` set.

Billing controls:

- Use Stripe dashboard exports, `subscription`, `credit_ledger`, and `audit_event` `stripe.*` rows.
- Reconcile replayed Stripe events to webhook audit metadata.

Privacy request workflow:

- Use `privacy_request` and `audit_event` events `privacy.data_export.requested` and `privacy.account_deletion.requested`.
- Confirm due dates, status, completion or rejection reason, and requester identity.

## Audit Completeness

An evidence package is complete when each control has query text, time range, production environment identifier, operator identity, result output, and a reviewer sign-off. Exceptions require owner, risk, compensating control, and expiration date.
