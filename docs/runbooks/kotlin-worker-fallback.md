# Kotlin Worker Fallback Runbook

## Owner

Primary: Document conversion owner. Backup: Operations owner with Vercel and Supabase access.

## Severity

Sev 1 when worker-backed conversion blocks all document processing or risks retention expiry. Sev 2 when only worker-enabled staging or pilot traffic is affected. Sev 3 when the worker is disabled and Textract-backed production traffic is healthy.

## Detection

- `document.extraction_engine = 'kotlin_worker'` rows remain `processing` longer than the expected worker timeout.
- Status polling marks documents failed with `Kotlin worker could not be polled by this deployment.` or a worker timeout reason.
- Worker health checks, logs, or backlog metrics show failures, stale jobs, or rising age.
- Public v1 responses still include `textractJobId`, but audit metadata shows `extraction_engine = 'kotlin_worker'`.

## Response

To disable the worker and fall back to Textract:

1. Set `PRIZM_EXTRACTION_ENGINE=textract` or remove `PRIZM_EXTRACTION_ENGINE` from the affected non-production environment.
2. Redeploy the Next.js app so new conversions start the default Textract engine.
3. Confirm new `document` rows record `extraction_engine = 'textract'` and a neutral `extraction_job_id`.
4. Triage existing `kotlin_worker` processing rows separately: let healthy jobs finish, retry with Textract if product policy allows, or mark failed with clear support guidance.
5. Keep `KOTLIN_WORKER_URL` and `KOTLIN_WORKER_API_KEY` disabled or rotated until the worker health proof is green again.

Do not enable `kotlin_worker` in production until the staging proof covers worker health, S3 access, KMS decrypt, extraction success, PRIZM statement persistence, retry behavior, and dead-letter handling.

## Verification

- A known-good PDF starts under `extraction_engine = 'textract'`, reaches `ready`, and creates a `statement` row.
- `/api/v1/documents/{documentId}/convert` remains backward compatible and includes `textractJobId`.
- `/api/v1/documents/{documentId}/status` returns the refreshed document state without exposing raw worker output.
- No worker-backed processing row remains without an owner, retry decision, or failure reason.
