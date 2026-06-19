# CONTEXT

Domain vocabulary for the PRIZM Kotlin extractor at `workers/kotlin-extractor/`. Names declared here are load-bearing: changes to them touch the entire orchestrator, the family engines, and the wire contract. Keep this file accurate as the seams evolve.

## Statement family

A coarse grouping by reconciliation math, not by issuer. `CreditCard`, `Bank`, `Unknown`. Encoded as `StatementFamily`.

The math for a family is hard-coded and cannot be overridden by an issuer-specific layout. A new family means new math, a new issuer means a new layout under the existing family.

## Family engine

The adapter that owns extraction within one family. Defined by `FamilyEngine`. Each engine implements `extract(text, issuer)` and declares a `stageName` used by the structured logger.

The orchestrator `PdfStatementExtractor` routes via `Map<StatementFamily, FamilyEngine>`. A missing entry returns `ExtractionOutcome.UnsupportedLayout`. Two adapters ship today: `CreditCardEngine` (live) and `BankEngine` (stub returning `UnsupportedLayout` until the bank reconciler lands).

## Reconciler

The math contract for one family. Defined by `Reconciler<T>` where `T` is the family-specific totals type. `reportedTotal` reads the family's printed totals, `computedTotal` sums signed transaction rows, `reconcile` returns a `ReconciliationResult` with both numbers and the verdict.

The interface is the test surface. Contract tests target the reconciler directly, separate from the engine that wraps it.

## Text source

The PDF-text producer. Defined by `TextSource`. `extract(path)` returns the document's text, or `null` when the source cannot produce text from this PDF.

The orchestrator tries sources in order and returns `ExtractionOutcome.NoSelectableText` only when every source returns `null`. ADR-009's fail-closed contract for scanned PDFs is honoured through composition, not through a hard-coded check in the orchestrator.

Today's sole adapter is `SelectableTextSource` (Apache PDFBox). OCR and LLM adapters plug into the same slot when they land.

## Extraction outcome

The internal result type for one extraction attempt. `ExtractionOutcome` is sealed: `Success`, `NoSelectableText`, `UnsupportedLayout`, `MissingField`, `UnexpectedFailure`.

The HTTP and CLI boundaries map each variant to a stable `WorkerPollResponse`. Customer-facing failure messages live in one place, tests do not depend on exception strings.

## Wire response vs extraction outcome

`ExtractionOutcome` is internal to the extractor. `WorkerPollResponse` is the JSON contract the Cloudflare Worker reads. The boundary mapping lives in `ExtractionOutcome.toWorkerPollResponse(jobId)`. Nothing else constructs `WorkerPollResponse` directly.

## Issuer

The customer-facing identity (e.g. "Chase", "Bank of America") plus a `layoutKey` that selects regex variants for period and row extraction. Defined by `IssuerProfile`. Identity affects only metadata, layout affects only how text is sliced. Neither changes family-level math.

## Statement family detector

Deterministic family detection from label presence. Defined by `StatementFamilyDetector`. Returns `Unknown` when neither family's anchor labels appear, which the orchestrator translates to `UnsupportedLayout` via the missing-engine path.
