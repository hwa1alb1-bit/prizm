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

After the proof is complete, set these launch gate variables in the production GitHub/Vercel environment:

- `CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID`
- `CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT`
- `CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA`

## Verification

- A known-good PDF starts under `extraction_engine = 'textract'`, reaches `ready`, and creates a `statement` row.
- `/api/v1/documents/{documentId}/convert` remains backward compatible and includes `textractJobId`.
- `/api/v1/documents/{documentId}/status` returns the refreshed document state without exposing raw worker output.
- No worker-backed processing row remains without an owner, retry decision, or failure reason.
