package com.prizm.extractor

/**
 * Outcome of a single PDF extraction attempt. The Kotlin parser layer returns one of these; the
 * HTTP/CLI boundary maps each variant to a stable [WorkerPollResponse] shape so customer-facing
 * messages live in one place and tests do not depend on exception message text.
 */
sealed class ExtractionOutcome {
  data class Success(val statement: ParsedStatement) : ExtractionOutcome()
  data object NoSelectableText : ExtractionOutcome()
  data object UnsupportedLayout : ExtractionOutcome()
  data class MissingField(val family: StatementFamily, val field: String) : ExtractionOutcome()
  data class UnexpectedFailure(val message: String) : ExtractionOutcome()
}

internal fun ExtractionOutcome.toWorkerPollResponse(jobId: String): WorkerPollResponse =
  when (this) {
    is ExtractionOutcome.Success ->
      WorkerPollResponse(status = "succeeded", jobId = jobId, statements = listOf(statement))
    ExtractionOutcome.NoSelectableText ->
      WorkerPollResponse(
        status = "failed",
        jobId = jobId,
        failureReason = "Selectable text was not found. Scanned or image-only PDFs are unsupported.",
      )
    ExtractionOutcome.UnsupportedLayout ->
      WorkerPollResponse(
        status = "failed",
        jobId = jobId,
        failureReason = "Unsupported text statement layout.",
      )
    is ExtractionOutcome.MissingField ->
      WorkerPollResponse(
        status = "failed",
        jobId = jobId,
        failureReason = "Required field not found: $field",
      )
    is ExtractionOutcome.UnexpectedFailure ->
      WorkerPollResponse(status = "failed", jobId = jobId, failureReason = message)
  }
