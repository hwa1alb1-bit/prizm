# Kotlin Extraction Worker Development Plan

Date: 2026-05-11
Status: ready for implementation planning

## Summary

PRIZM now has a neutral extraction engine seam in the Next.js app. The next development phase is to build a private AWS-hosted Kotlin/JVM extraction worker that plugs into that seam without changing the customer workflow.

The product stays the same: upload a PDF statement, review extracted rows, then export formatted XLSX, CSV, QuickBooks CSV, or Xero CSV output.

## Recommended Approach

Build the worker as a private AWS service that owns extraction work only. Keep PRIZM's Next.js app responsible for auth, upload verification, billing, status, review, export, audit, and retention.

Use the current Textract engine as the compatibility baseline. The Kotlin worker should return normalized PRIZM statement JSON, not raw OCR blocks, so the existing review and export gates continue to work.

## Architecture

- Next.js starts conversion after a verified upload and credit reservation.
- The extraction seam records `extraction_engine` and `extraction_job_id`.
- The Kotlin worker reads the PDF from the existing S3 bucket using its AWS task role.
- The worker performs OCR and statement parsing, then returns normalized statement data.
- PRIZM stores statement rows, marks the document ready, consumes the credit, and writes audit evidence.
- Structured but unreconciled output remains reviewable and blocked from export until corrected.

## First Implementation Slice

1. Add a second engine implementation behind `lib/server/extraction-engine.ts`.
2. Name it `kotlin_worker` in code, but keep it disabled by default.
3. Add env-gated selection so production keeps `textract` until the worker is proven.
4. Add contract tests with one bank fixture and one credit-card fixture.
5. Add local fake-worker tests before any AWS deployment work.
6. Keep public v1 API responses backward compatible with `textractJobId`.

## AWS Slice

Use AWS only after the local contract is green.

- Choose one private compute target: ECS Fargate or App Runner.
- Add a task role with scoped S3 read, KMS decrypt, and logging permissions.
- Do not reuse the Vercel OIDC role for the worker.
- Add CloudWatch logs, health checks, timeout metrics, and backlog age metrics.
- Add a retry and dead-letter story before enabling production traffic.
- Add readiness proof for worker health, S3 access, KMS decrypt, extraction success, and PRIZM statement persistence.

## Data And Contracts

The worker output must map to PRIZM's normalized statement model:

- statement type
- bank or issuer name
- account or card last 4
- period start and end
- opening and closing balances
- reported total
- computed total
- reconciliation status
- confidence summary
- review flags
- transaction rows with date, description, amount, debit, credit, balance, source, confidence, and review reason

Do not expose worker output directly to customers. The customer-facing output remains reviewed spreadsheet export.

## TDD Order

1. Contract test: Kotlin worker response creates one reviewable bank statement.
2. Contract test: Kotlin worker response creates one reviewable credit-card statement.
3. Processing test: unreconciled structured output is stored and marked ready for review.
4. Failure test: timeout or unsupported document releases credit and marks document failed.
5. Route test: convert and status stay backward compatible.
6. Integration test: known fixture reaches reviewed CSV export.
7. Production proof: known-good PDF completes through staging with audit evidence.

## Risks

- Split-brain processing if Next.js and the worker both own the same job.
- Overbroad Supabase service-role access if the worker writes directly to the database.
- Hidden retention risk if worker backlog approaches the 24-hour delete window.
- Premature AWS work before local contract tests prove the seam.
- Confusing support evidence if `textractJobId` and `extractionJobId` diverge without clear naming.

## Acceptance Criteria

- `pnpm verify` passes.
- Existing Textract path remains the default and still works.
- Worker engine can be enabled by environment flag in non-production.
- Contract tests prove normalized statement output for bank and credit-card fixtures.
- Unreconciled but structured extraction is reviewable.
- Export remains blocked until review and reconciliation.
- No public v1 breaking changes.
- Runbook describes how to disable the worker and fall back to Textract.

## Callable Development Prompt

Use this prompt to start the next implementation session:

```text
Continue PRIZM extraction development from docs/superpowers/specs/2026-05-11-kotlin-extraction-worker-development-plan.md.

Use TDD. Start with the smallest local slice only. Do not deploy AWS infrastructure yet.

Goal: add a disabled-by-default `kotlin_worker` extraction engine implementation behind the existing extraction seam. Prove the contract with bank and credit-card fixtures that return normalized PRIZM statement data. Keep Textract as the default engine and keep public v1 responses backward compatible.

Required proof: targeted contract tests, processing tests, route compatibility tests, and `pnpm verify`.
```
