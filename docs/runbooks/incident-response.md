# Incident Response Runbook

## Owner

Primary: Security and Operations owner. Backup: Engineering lead with Supabase service-role and Vercel production access.

## Severity

Treat suspected unauthorized access, cross-workspace data exposure, failed deletion controls, leaked credentials, or payment tampering as Sev 1. Treat isolated provider degradation with no customer data exposure as Sev 2 or Sev 3 based on user impact.

## Detection

- Alerts or dashboard anomalies from Sentry, Vercel, Supabase, Stripe, or AWS.
- `audit_event` spikes for `ops.admin_login`, `ops.dashboard_read`, `privacy.*.requested`, `document.deleted`, `statement.deleted`, or `stripe.*`.
- Provider health changes in `ops_usage_snapshot` and failed `ops_collection_run` rows from `/api/ops/collect`.
- Deletion monitor changes in `deletion_health`, especially red status or nonzero expired survivors.
- User reports through support, privacy, billing, or security disclosure channels.

## Response

First 15 minutes:

1. Assign an incident commander and open an incident channel with timestamped notes.
2. Confirm scope: impacted workspaces, routes, provider, data classes, and whether customer data or billing state is affected.
3. Freeze risky changes; keep responders from making untracked production changes.
4. Preserve evidence before remediation where possible: Vercel deployment ID, request IDs, trace IDs, audit rows, provider console screenshots, and relevant database row counts.
5. Decide immediate containment: disable affected route, revoke credential, rotate secret, pause webhook processing, or block provider calls.

User comms:

- If customer data, account deletion, privacy request, billing, or availability is affected, draft a customer-facing update within 30 minutes of Sev 1 confirmation.
- Include impact, start time, current mitigation, customer action if any, and next update time.
- Do not speculate about root cause until evidence supports it.

Evidence to collect:

- `audit_event` rows for the incident window and impacted workspace IDs.
- `ops_collection_run` and `ops_usage_snapshot` rows for provider status.
- `deletion_health`, `deletion_evidence`, `deletion_sweep_run`, and `deletion_receipt` rows for deletion incidents.
- `privacy_request` rows for SAR or account deletion incidents.
- Stripe event IDs and replay attempts for billing incidents.
- Vercel deployment/build IDs, Sentry issue IDs, Supabase query logs, AWS request IDs, and responder notes.

Expected audit events:

- `ops.admin_login`
- `ops.dashboard_read`
- `ops.provider_drilldown_read`
- `ops.provider_refresh_requested`
- `ops.quick_link_clicked`
- Provider-specific collection events: `ops.provider_collection_completed` or `ops.provider_collection_failed`
- Domain events when relevant: `privacy.data_export.requested`, `privacy.account_deletion.requested`, `document.deleted`, `statement.deleted`, `deletion.stale_survivors_detected`, and `stripe.*`

## Verification

- Impacted workflow is working in production or intentionally disabled with a customer-facing status.
- Audit evidence covers detection, containment, remediation, and closure.
- Provider status is green or has documented compensating controls.
- No unresolved expired survivors remain in `deletion_health` unless accepted as an open incident risk.
- Post-incident review is filed with timeline, root cause, corrective actions, owner, and due dates.
