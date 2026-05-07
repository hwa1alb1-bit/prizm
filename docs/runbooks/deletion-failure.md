# Deletion Failure Runbook

## Owner

Primary: Privacy and Security owner. Backup: Engineering lead for deletion runtime.

## Severity

Sev 1 when expired documents or statements remain accessible beyond the deletion SLA, deletion evidence is missing for a completed deletion, or account deletion creates inconsistent retained data. Sev 2 when deletion receipt email fails but data has been deleted. Sev 3 when monitor telemetry is stale but manual verification passes.

## Detection

- `/api/ops/deletion/monitor` shows red or yellow deletion health.
- `deletion_health.expired_survivors` is greater than zero or `receipt_failures` is greater than zero.
- `deletion_sweep_run.status` is failed or partial after `/api/ops/deletion/sweep`.
- `deletion_evidence` shows expired documents with null `deleted_at`, missing receipt status, or missing `deletion_audited_at`.
- `audit_event` includes `deletion.stale_survivors_detected`.

## Response

First 15 minutes:

1. Query `deletion_health` and the latest `deletion_sweep_run`.
2. Identify affected `document` and `statement` rows from `deletion_evidence` and survivor queries.
3. Confirm whether S3 objects remain present for affected documents.
4. Run or schedule a manual deletion sweep only after preserving evidence.
5. If privacy-request account deletion is affected, update the `privacy_request` owner and due-date risk.

User comms:

- If retained data exceeded the documented deletion SLA, notify the impacted workspace owner with impact, correction time, and whether any customer action is required.
- If only receipt delivery failed and deletion succeeded, send a corrected receipt after verifying evidence.

Evidence to collect:

- `deletion_health` at detection and closure.
- `deletion_sweep_run` counts: expired, deleted, S3 deleted/absent, receipts, receipt failures, survivors.
- `deletion_evidence` for impacted `document_id` values.
- `audit_event` rows for `document.deleted`, `statement.deleted`, and `deletion.stale_survivors_detected`.
- S3 object lookup result and request ID for each affected document.
- Related `privacy_request` rows for account deletion workflows.

Expected audit events:

- `document.deleted`
- `statement.deleted`
- `deletion.stale_survivors_detected`
- `privacy.account_deletion.requested` when user-initiated account deletion is involved

## Verification

- `deletion_health.status` is green after a fresh monitor run.
- `deletion_evidence` shows `deleted_at`, expected receipt state, and `deletion_audited_at` for affected documents.
- No expired `document` or `statement` rows remain undeleted beyond the five-minute monitor grace period.
- Incident notes include whether the 24-hour document retention expectation and privacy request deadlines were met.
