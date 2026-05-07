# Subject Access Request Workflow

Subject access requests are recorded in `privacy_request` with `request_type = 'data_export'`. The request route writes the workflow record and an `audit_event` row together.

## Intake

- Authenticated user submits the data export route.
- Server creates `privacy_request` with status `received`, due date, actor IP, and actor user agent.
- Server records `audit_event.event_type = 'privacy.data_export.requested'`.
- Owner/admin users can review workspace-scoped privacy request records under RLS.

## Fulfillment

1. Validate requester identity and workspace membership.
2. Move request to `processing`.
3. Export data from the workspace-scoped tables: `workspace`, `user_profile`, `api_key` metadata, `document` metadata, `statement`, `subscription`, `credit_ledger`, `audit_event`, deletion evidence, and privacy request history.
4. Exclude service secrets, key hashes, internal provider credentials, and data belonging to other workspaces.
5. Deliver the export through an approved secure channel.
6. Mark the request `completed` with `completed_at`.

## SLA

Default due date is 30 days from request creation unless a stricter contractual or legal requirement applies. Requests that cannot be fulfilled must be marked `rejected` with a defensible reason and reviewed by the privacy owner.

## Evidence

- `privacy_request` row with status history, due date, and completion or rejection.
- `audit_event` row for `privacy.data_export.requested`.
- Export manifest with table names, row counts, workspace ID, creation timestamp, and delivery method.
- Reviewer approval for any rejection or redaction.

## Audit Completeness

A SAR is audit-complete when the request record, audit event, exported data manifest, delivery proof, and completion timestamp are all present and tied to the same workspace and requester.
