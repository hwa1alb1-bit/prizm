# ADR 009: Cloudflare R2 Kotlin Extraction Path

## Status

Accepted for feature-flagged implementation.

## Context

PRIZM's existing document lifecycle is upload -> complete -> convert -> status -> review/export. The current compatible path remains AWS S3 + Textract-shaped, but the launch direction for the new extraction path is a Kotlin/JVM-owned extractor for selectable-text PDFs only.

Scanned/image-only PDFs are unsupported for this launch path. They must fail closed and release reserved credits.

## Decision

Add a provider-neutral document storage and extraction seam:

- `DOCUMENT_STORAGE_PROVIDER=s3|r2`
- `DOCUMENT_EXTRACTION_PROVIDER=textract|cloudflare-r2`
- R2 env: `R2_ACCOUNT_ID`, `R2_UPLOAD_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- Cloudflare extractor env: `CLOUDFLARE_EXTRACTOR_URL`, `CLOUDFLARE_EXTRACTOR_TOKEN`

For the Cloudflare path, PRIZM writes uploads to R2-compatible object storage, submits extraction through the Cloudflare extractor boundary, stores normalized statement JSON, and keeps `textract_job_id` null. Public APIs expose `extractionJobId`; `textractJobId` is only a legacy Textract compatibility field.

## Benchmark Gate

`pnpm benchmark:extraction` is a required completion gate. It writes JSON evidence under `docs/evidence/extraction-benchmarks/` for 100, 250, and 500 concurrent text-PDF submissions.

The gate fails unless:

- `lostJobs` is 0.
- `duplicateCreditCharges` is 0.
- `duplicateStatementRows` is 0.
- `convertAcceptanceP95Ms` is below 2,000 ms.
- `timeToReadyP95Ms` and thresholds are recorded for 100, 250, and 500 submissions.
- Golden fixture output includes all required normalized statement fields.

## Cost Basis

The branch cost report compares the current AWS Textract `TABLES + FORMS` path against Cloudflare Workers/R2/Queues/Containers. The AWS basis is 5 pages per PDF at $0.065/page, which yields about $32.50, $81.25, and $162.50 for 100, 250, and 500 PDFs.

Official pricing references:

- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Queues pricing: https://developers.cloudflare.com/queues/platform/pricing/
- Cloudflare Containers pricing: https://developers.cloudflare.com/containers/pricing/
- AWS Textract pricing: https://aws.amazon.com/textract/pricing/

## Consequences

The Textract path remains available as compatibility/fallback until the Cloudflare path passes the benchmark gate. New rows use provider-neutral storage metadata while retaining S3-compatible column aliases during migration.
