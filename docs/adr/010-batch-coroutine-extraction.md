# ADR-010: Batch Coroutine Extraction Path

## Status

Accepted for feature-flagged implementation. Benchmark gate re-verification required before merge.

## Context

ADR-009 introduced the Cloudflare R2 + Kotlin extraction path as a per-message single-PDF contract: the Cloudflare Queue handler iterates messages, each job routes to its own Container Durable Object via `KOTLIN_EXTRACTOR.getByName(job.jobId)`, the container POSTs a single PDF to `/internal/extract`, and the JVM parses sequentially. This works but maximizes JVM cold-start cost: every queue message reaches a different DO name and so may spin up a fresh container.

PR #96 (2026-06-18) deferred Coroutines/Flow as "wrong tool for stateless single-PDF handler." That call was correct at the per-message granularity. It misses the per-batch granularity: the Cloudflare Queue delivers up to `max_batch_size: 5` messages per Worker invocation, and the Worker is free to bundle them into a single container call.

This ADR amends ADR-009 by adding a batch path while preserving the single-PDF wire contract.

## Decision

Two endpoints on the JVM:

- `/internal/extract` (unchanged). Accepts a binary PDF body. One job per POST. Returns `WorkerPollResponse`. The Worker uses this for batch-size-1 deliveries and as the fallback path.
- `/internal/extract-batch` (NEW). Accepts JSON `{ jobs: [{ jobId, pdfBase64 }] }`. The JVM uses `kotlinx-coroutines` `supervisorScope` to fan jobs out concurrently. `Dispatchers.IO` for temp-file write and base64 decode, `Dispatchers.Default` for PDFBox load and parse. Returns `{ results: [WorkerPollResponse] }` where each entry has the same shape as the single-PDF response.

The Worker queue handler routes the whole queue batch to one Container DO instance, keyed deterministically by sorted job ids (`batch_<sortedIds>`). Retries on the same batch hit the same warm container. Per-message failures (missing R2 object, wrong bucket) are recorded as failed job state before the container call, so they do not block sibling jobs. The container call timeout and per-job isolation are owned inside the JVM via `supervisorScope`.

## Container instance type

Stays at `basic`. Cloudflare's Oct 2025 tier reshuffle puts `basic` at 1 GiB memory / 1/4 vCPU, which holds `max_batch_size: 5` PDFs in JVM heap comfortably. A bump to `standard-1` (alias `standard`, 4 GiB / 1/2 vCPU) becomes a follow-up only if benchmark numbers force it. No plan change required (Workers Paid covers every tier through `standard-4`).

## Wire contract

Public extraction API unchanged. `WorkerPollResponse` shape preserved. Stage labels preserved: `pdfbox-load`, `family-detect`, `issuer-detect`, `credit-card-extract`. Failure strings preserved: `"Selectable text was not found..."`, `"Unsupported text statement layout."`. Existing R2 storage layout (`uploads/...`, `jobs/...`) unchanged.

## Benchmark Gate

`pnpm benchmark:extraction` is required to re-pass at 100, 250, and 500 concurrent text-PDF submissions:

- `lostJobs` must be 0.
- `duplicateCreditCharges` must be 0.
- `duplicateStatementRows` must be 0.
- `convertAcceptanceP95Ms` must remain below 2,000 ms.
- `timeToReadyP95Ms` recorded for 100, 250, 500.

New evidence file lands at `docs/evidence/extraction-benchmarks/<timestamp>-cloudflare-r2.json` and supersedes the 2026-06-18 baseline as the active benchmark.

## Consequences

Eased:

- JVM cold-start amortized across batch members. One warm container processes up to 5 PDFs vs. 5 cold-start containers each processing 1.
- Per-job isolation moves from "five different containers" to "five coroutines under one `supervisorScope`" — same isolation semantics, lower infrastructure cost.
- The single-PDF endpoint remains as a tested fallback path, so batch-size-1 deliveries behave identically to today.

Locked in:

- Batch payload size scales with `max_batch_size` × average PDF size × 1.33 (base64 inflation). At `max_batch_size: 5` and 2 MB average PDF this is ~13 MB per container POST, comfortably within Cloudflare's Worker -> Container limits.
- The deterministic batch key (`batch_<sortedJobIds>`) is the routing surface. Sibling batches with different message contents land on different containers. This is the price for retry warmth: identical batches go to the same warm container; mixed retries do not.
- One bad batch result mapping (container returns `results` array missing a jobId) writes failed state for the missing entry. The Worker treats that as a permanent failure (acks the message). Bug surface for the JVM to test.

## Alternatives considered

- Worker streams a single multipart batch body. Rejected: multipart parsing on the JVM adds dependency surface and complicates retries.
- Worker sends presigned R2 URLs and JVM fetches in parallel. Rejected for first ship: requires Worker-side AWS Signature v4 code and adds R2 latency inside the container critical path. May be revisited if base64 inflation becomes a measurable cost.
- Container DO per job (current). Kept as the batch-size-1 fallback. Not removed.

## Verification

- 45 Kotlin unit tests pass (was 42); `BatchExtractionHandlerTest` covers the supervisorScope isolation contract.
- `pnpm verify` green: vitest, format:check, lint, typecheck, build.
- `cloudflare-extractor-worker.test.ts` adds 4 batch cases: routing, missing-R2 isolation, 5xx retry, per-jobId result mapping.
- `pnpm benchmark:extraction` re-pass before merge.
- Live smoke against prod with one real fixture after deploy.
