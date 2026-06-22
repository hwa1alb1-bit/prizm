package com.prizm.extractor

import kotlin.test.Test
import kotlin.test.assertEquals

class ExtractionOutcomeTest {
  @Test
  fun `NoSelectableText maps to failed with the historical user-facing message`() {
    val response = ExtractionOutcome.NoSelectableText.toWorkerPollResponse("job-1")
    assertEquals("failed", response.status)
    assertEquals("job-1", response.jobId)
    assertEquals(
      "Selectable text was not found. Scanned or image-only PDFs are unsupported.",
      response.failureReason,
    )
  }

  @Test
  fun `UnsupportedLayout maps to failed with the historical user-facing message`() {
    val response = ExtractionOutcome.UnsupportedLayout.toWorkerPollResponse("job-2")
    assertEquals("failed", response.status)
    assertEquals("Unsupported text statement layout.", response.failureReason)
  }

  @Test
  fun `MissingField names the missing field in the failureReason`() {
    val response = ExtractionOutcome.MissingField(StatementFamily.CreditCard, "previousBalance")
      .toWorkerPollResponse("job-3")
    assertEquals("failed", response.status)
    assertEquals("Required field not found: previousBalance", response.failureReason)
  }

  @Test
  fun `UnexpectedFailure relays its message verbatim`() {
    val response = ExtractionOutcome.UnexpectedFailure("disk read error")
      .toWorkerPollResponse("job-4")
    assertEquals("failed", response.status)
    assertEquals("disk read error", response.failureReason)
  }

  @Test
  fun `Success wraps the statement and reports succeeded`() {
    val statement = ParsedStatement(
      statementType = "credit_card",
      bankName = "Test Bank",
      accountLast4 = "1234",
      periodStart = "2026-04-01",
      periodEnd = "2026-04-30",
      openingBalance = 0.0,
      closingBalance = 0.0,
      reportedTotal = 0.0,
      computedTotal = 0.0,
      reconciles = true,
      ready = true,
      confidence = Confidence(1.0, 1.0, 1.0),
      reviewFlags = emptyList(),
      metadata = emptyMap(),
      transactions = emptyList(),
    )
    val response = ExtractionOutcome.Success(statement).toWorkerPollResponse("job-5")
    assertEquals("succeeded", response.status)
    assertEquals(listOf(statement), response.statements)
  }
}
