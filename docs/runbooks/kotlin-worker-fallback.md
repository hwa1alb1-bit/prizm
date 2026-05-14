# Kotlin Worker Fallback Runbook

## Owner

Primary: Document conversion owner. Backup: Operations owner with Vercel and Supabase access.

## Severity

Sev 1 when container-backed conversion blocks all document processing or risks retention expiry. Sev 2 when only staging or pilot traffic is affected. Sev 3 when the legacy worker flag is disabled and the Cloudflare R2 production path remains healthy.

## Detection

- `document.extraction_engine = 'kotlin_worker'` rows remain `processing` longer than the expected worker timeout.
- Status polling marks documents failed with `Kotlin worker could not be polled by this deployment.` or a worker timeout reason.
- Worker health checks, logs, or backlog metrics show failures, stale jobs, or rising age.
- Public v1 responses still include `textractJobId`, but audit metadata shows `extraction_engine = 'kotlin_worker'`.

## Response

To disable the legacy worker flag without changing the launch provider:

1. Remove `PRIZM_EXTRACTION_ENGINE=kotlin_worker` from the affected environment.
2. Keep `DOCUMENT_STORAGE_PROVIDER=r2` and `DOCUMENT_EXTRACTION_PROVIDER=cloudflare-r2` unless the product owner explicitly reopens the Textract fallback decision.
3. Redeploy the Next.js app so new conversions use the configured launch provider.
4. Triage existing `kotlin_worker` processing rows separately: let healthy jobs finish, retry through the Cloudflare R2 extractor when possible, or mark failed with clear support guidance.
5. Keep `KOTLIN_WORKER_URL` and `KOTLIN_WORKER_API_KEY` disabled or rotated until the worker health proof is green again.

Do not enable `kotlin_worker` in production until the staging proof covers worker health, R2 storage access, extraction success, PRIZM statement persistence, retry behavior, and dead-letter handling. For the production launch path, prefer `DOCUMENT_EXTRACTION_PROVIDER=cloudflare-r2`; keep the legacy `PRIZM_EXTRACTION_ENGINE=kotlin_worker` flag out of production.

## Cloudflare R2 Production Enablement Proof

Before setting `DOCUMENT_EXTRACTION_PROVIDER=cloudflare-r2` in production, run the proof from staging against the container-backed Cloudflare Worker deployment, not the no-Docker Wrangler dry run.

Required proof evidence:

- Worker health: call the authenticated Worker `/v1/health` endpoint and archive an `ok` response. The Worker must have `HEALTHCHECK_STORAGE_KEY` configured, and the corresponding PRIZM launch gate variable is `CLOUDFLARE_EXTRACTOR_HEALTHCHECK_STORAGE_KEY`.
- R2 storage access: seed a known-good selectable-text PDF at the healthcheck key and confirm `/v1/health` reports the upload bucket probe as `ok`.
- Extraction success: start a staging extraction through the deployed Worker with the seeded PDF, poll until `succeeded`, and archive the Worker job ID plus sanitized normalized statement output.
- Statement persistence: run the PRIZM staging conversion path for the same document and archive the `document.processing_ready` audit event plus the created `statement` row ID.
- Retry behavior: force an infrastructure-style state write failure in staging or a controlled lower environment and confirm the queue message is retried rather than acknowledged.
- Dead-letter handling: confirm the `prizm-extractions` consumer has `max_retries`, `retry_delay`, and `dead_letter_queue=prizm-extractions-dlq`, then archive the DLQ evidence for an exhausted controlled failure.

After the proof is complete: Set the provider flags, R2 S3 credentials, Worker URL/token, healthcheck key, and staging proof variables in one Vercel production change window. Do not first set only `DOCUMENT_STORAGE_PROVIDER=r2` and `DOCUMENT_EXTRACTION_PROVIDER=cloudflare-r2`; the launch gate must see the full Cloudflare bundle together.

Full production launch bundle:

- `DOCUMENT_STORAGE_PROVIDER=r2`
- `DOCUMENT_EXTRACTION_PROVIDER=cloudflare-r2`
- `R2_ACCOUNT_ID`
- `R2_UPLOAD_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_EXTRACTOR_URL`
- `CLOUDFLARE_EXTRACTOR_TOKEN`
- `CLOUDFLARE_EXTRACTOR_HEALTHCHECK_STORAGE_KEY`

- `CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID`
- `CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT`
- `CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA`

## Verification

- A known-good PDF starts under `extraction_engine = 'cloudflare-r2'`, reaches `ready`, and creates a `statement` row.
- `/api/v1/documents/{documentId}/convert` remains backward compatible and keeps `textractJobId` null for Cloudflare jobs.
- `/api/v1/documents/{documentId}/status` returns the refreshed document state without exposing raw worker output.
- No worker-backed processing row remains without an owner, retry decision, or failure reason.
