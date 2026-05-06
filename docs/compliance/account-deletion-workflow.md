# Account Deletion Workflow

Account deletion requests are tracked as workflow records in `privacy_request` with `request_type = 'account_deletion'`. They are not immediate untracked destructive mutations.

## Intake

- Authenticated user submits the account deletion route.
- Server creates `privacy_request` with status `received`, due date, requester, workspace ID, actor IP, and user agent.
- Server records `audit_event.event_type = 'privacy.account_deletion.requested'`.

## Fulfillment

1. Validate requester authority for the workspace and confirm whether deletion applies to a single user or the workspace.
2. Move request to `processing`.
3. Inventory retained data: `document`, `statement`, `subscription`, `credit_ledger`, `audit_event`, `deletion_evidence`, and prior `privacy_request` rows.
4. Delete or anonymize eligible account data according to product retention rules and legal hold constraints.
5. Confirm expired uploaded documents and statements are removed by the deletion sweep.
6. Preserve required accounting, security, and audit records when retention is legally required.
7. Mark request `completed` or `rejected` with reason.

## Deletion SLA

- Uploaded documents and extracted statements are temporary records with expiry timestamps and deletion monitoring.
- Vercel cron runs `/api/ops/deletion/sweep` every 15 minutes and `/api/ops/deletion/monitor` every 5 minutes.
- `deletion_health` must be green or have a documented exception before closing account deletion.
- Account deletion privacy requests use a 10-day due date from request intake.

## Evidence

- `privacy_request` row and `privacy.account_deletion.requested` audit event.
- `deletion_evidence` for affected documents.
- `deletion_health` at closure.
- `deletion_sweep_run` showing successful sweep, receipt counts, and survivor count.
- `audit_event` rows for `document.deleted` and `statement.deleted`.
- Any retained data exception, legal basis, owner, and expiration date.

## Audit Completeness

Closure is complete only when workflow status, deletion evidence, sweep health, audit events, customer communication, and retained-data exceptions are all linked to the workspace and request.
