# AWS Textract Degradation Runbook

## Owner

Primary: Document conversion owner. Backup: Operations owner with AWS and Vercel access.

## Severity

Sev 1 when all document conversion is unavailable or uploaded PDFs cannot be processed before retention expiry. Sev 2 when conversion is slow, partially failing, or limited to one AWS region. Sev 3 when degradation is internal-only and customer conversion is unaffected.

## Detection

- Conversion route errors or Sentry issues point to AWS Textract.
- Uploaded `document` rows remain `pending` or `processing` longer than expected, or move to `failed` with Textract-related `failure_reason`.
- AWS provider metrics in `ops_usage_snapshot` or credential gap checks are yellow, red, gray, stale, or failed.
- Users report missing statements, delayed conversion, or repeated upload failures.

## Response

First 15 minutes:

1. Confirm whether the failure is credentials, AWS regional outage, Textract API throttling, S3 access, or document-specific input.
2. Check affected `document` rows for status, `textract_job_id`, S3 bucket/key, expiry, and failure reason.
3. Check AWS console and provider status; capture request IDs if available.
4. Pause duplicate retries if they increase throttling or cost.
5. Decide whether to queue conversions, fail fast with user-visible error, or temporarily disable upload.

User comms:

- Tell users whether uploads are accepted but delayed, rejected for retry later, or failed and need re-upload.
- For documents near expiry, state whether retention was extended through an approved exception or whether re-upload is required.

Evidence to collect:

- Affected `document` and `statement` row IDs and statuses.
- AWS Textract request IDs, job IDs, error codes, and CloudWatch excerpts.
- S3 object existence checks for affected `s3_bucket` and `s3_key`.
- `ops_usage_snapshot` and `ops_collection_run` rows for AWS-related providers.
- Related Vercel request IDs, trace IDs, and Sentry issues.

Expected audit events:

- `ops.provider_collection_failed` for AWS provider telemetry failures.
- `ops.provider_refresh_requested` for manual AWS health rechecks.
- `document.deleted` and `statement.deleted` later if expired uploaded data is swept before successful conversion.

## Verification

- A new known-good PDF completes conversion and produces the expected `statement` row.
- Backlogged documents are either converted, failed with clear customer guidance, or deleted according to retention policy.
- Provider health is green or has a documented exception and expiry.
- No document remains in an ambiguous processing state without an owner and next action.
