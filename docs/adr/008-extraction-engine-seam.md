# ADR-008: Extraction Engine Seam

Status: accepted
Date: 2026-05-11

## Context

PRIZM currently starts and polls AWS Textract directly from the Next.js app. That kept Phase 1 small, but it also couples document conversion to one OCR provider and one response shape. The next product direction is a stronger statement extraction engine, potentially implemented as a private Kotlin/JVM service on AWS.

The user workflow should not change. Customers upload one PDF, review extracted rows, and export formatted XLSX, CSV, QuickBooks CSV, or Xero CSV.

## Decision

Add a neutral internal extraction-engine boundary in the Next.js app before adding a Kotlin service. The boundary starts an extraction job from a verified S3 object and later polls for normalized PRIZM statement data.

Textract remains the default engine behind the boundary. Persist `document.extraction_engine` and `document.extraction_job_id` as the neutral identity. Keep `document.textract_job_id` mirrored as the v1 compatibility alias while Textract is the only live engine.

Structured extraction that has usable transaction rows but does not reconcile becomes a ready, unreviewed statement. Existing review and export gates continue to block ledger output until reconciliation and review are complete.

## Consequences

Eased:

- Future Kotlin/AWS extraction can replace the engine internals without changing upload, billing, status, review, export, retention, or audit routes.
- PRIZM owns formatted spreadsheet output and review semantics instead of exposing raw OCR as the product contract.
- Unreconciled but useful extraction reaches the reviewer instead of being discarded.

Locked in:

- Engine output must map to PRIZM's normalized statement model.
- Public v1 responses keep `textractJobId` until a later API version removes the compatibility alias.
- The first slice does not add AWS compute, queues, Kotlin build steps, or worker deployment lanes.

## Alternatives considered

- Build the Kotlin worker first: rejected because it adds AWS compute, CI, queue ownership, and database-write risk before PRIZM has a stable seam.
- Return raw OCR blocks to PRIZM: rejected because the useful product contract is reviewed spreadsheet rows, not OCR internals.
- Add a full extraction job table now: rejected as more migration and lifecycle scope than the first seam needs.

## Verification

- Conversion starts the selected extraction engine, stores neutral job identity, and still returns `textractJobId`.
- Processing polls the neutral engine contract and stores normalized statements.
- Structured unreconciled output is reviewable and remains blocked from export by existing review gates.
- Textract fixtures continue to produce the same bank and credit-card statement behavior through the adapter.
- `pnpm verify` passes.
