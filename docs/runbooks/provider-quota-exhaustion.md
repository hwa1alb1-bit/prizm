# Provider Quota Exhaustion Runbook

## Owner

Primary: Operations owner. Backup: Finance or billing administrator for paid quota increases.

## Severity

Sev 1 when quota exhaustion prevents core document conversion, billing, deletion evidence, or customer communication. Sev 2 when degradation is limited to one noncritical provider or internal dashboard collection. Sev 3 when usage is above warning threshold but work continues.

## Detection

- `ops_usage_snapshot.status` is yellow or red for usage, requests, bytes, emails, events, connections, or USD metrics.
- `ops_collection_run.status` is partial or failed with quota-related `error_detail`.
- Provider console reports rate limit, spending limit, daily cap, monthly cap, or email limit exhaustion.
- Users report throttled uploads, conversion failures, delayed receipts, or missing transactional email.

## Response

First 15 minutes:

1. Confirm the provider, metric key, used value, and `limit_value` from `ops_usage_snapshot`.
2. Identify the source of demand: customer traffic, replay loop, cron route, webhook replay, deletion sweep, or manual operation.
3. Disable or slow nonessential jobs before increasing spend.
4. If core workflow is blocked, request quota increase or move traffic to approved fallback.
5. Record the decision and approver for any billing or quota change.

User comms:

- Notify affected users when uploads, conversion, email receipts, or billing updates are delayed.
- Include whether work is queued, retried, or requires user action.

Evidence to collect:

- `ops_usage_snapshot` rows before and after mitigation.
- `ops_collection_run` rows showing collection trigger and result.
- Provider usage console screenshot with quota period.
- Related `audit_event` rows, especially manual refresh and dashboard access events.
- Any rate-limit response headers, provider request IDs, and Sentry issues.

Expected audit events:

- `ops.provider_collection_failed` when collection cannot read usage or quota is exhausted.
- `ops.provider_refresh_requested` when an operator manually rechecks.
- `ops.quick_link_clicked` when navigating from the ops dashboard to provider billing or management.

## Verification

- Required provider metric returns green or yellow with documented runway.
- No retry loop is continuing to consume exhausted quota.
- Customer-impacting jobs have completed or have an owner, queue, and expected completion time.
- Billing or quota change has an approver and evidence attached to the incident.
