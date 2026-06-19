package com.prizm.extractor

import java.nio.file.Files
import java.nio.file.Path
import java.util.Base64
import kotlin.io.path.div
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlinx.coroutines.runBlocking
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.font.PDType1Font
import org.apache.pdfbox.pdmodel.font.Standard14Fonts
import org.junit.jupiter.api.io.TempDir

/**
 * The batch handler runs each job inside a [kotlinx.coroutines.supervisorScope] so sibling
 * jobs survive any per-job failure. These tests exercise mixed batches that combine
 * successful extraction, garbage payload, unsupported layout, and reconciliation mismatch.
 */
class BatchExtractionHandlerTest {
  @Test
  fun `mixed batch returns one result per job and isolates failures from siblings`(@TempDir tempDir: Path) {
    val successPdf = base64Pdf(tempDir / "success.pdf", reconcilingCreditCardLines())
    val unsupportedPdf = base64Pdf(tempDir / "unsupported.pdf", listOf((1..40).joinToString(" ") { "lorem ipsum dolor sit amet consectetur adipiscing elit" }))
    val garbageBase64 = "this-is-not-valid-base64-content!!!"

    val response = runBlocking {
      BatchExtractionHandler().handle(
        BatchExtractionRequest(
          jobs = listOf(
            BatchJob(jobId = "job-success", pdfBase64 = successPdf),
            BatchJob(jobId = "job-garbage", pdfBase64 = garbageBase64),
            BatchJob(jobId = "job-unsupported", pdfBase64 = unsupportedPdf),
          ),
        ),
      )
    }

    assertEquals(3, response.results.size)
    val byJobId = response.results.associateBy { it.jobId }

    val success = assertNotNull(byJobId["job-success"])
    assertEquals("succeeded", success.status)
    val statement = assertNotNull(success.statements.singleOrNull())
    assertEquals("credit_card", statement.statementType)

    val garbage = assertNotNull(byJobId["job-garbage"])
    assertEquals("failed", garbage.status)
    assertNotNull(garbage.failureReason)

    val unsupported = assertNotNull(byJobId["job-unsupported"])
    assertEquals("failed", unsupported.status)
    assertEquals("Unsupported text statement layout.", unsupported.failureReason)
  }

  @Test
  fun `empty batch returns empty results without throwing`() {
    val response = runBlocking {
      BatchExtractionHandler().handle(BatchExtractionRequest(jobs = emptyList()))
    }

    assertEquals(0, response.results.size)
  }

  @Test
  fun `each job result carries its own jobId`(@TempDir tempDir: Path) {
    val pdfA = base64Pdf(tempDir / "a.pdf", reconcilingCreditCardLines())
    val pdfB = base64Pdf(tempDir / "b.pdf", reconcilingCreditCardLines())

    val response = runBlocking {
      BatchExtractionHandler().handle(
        BatchExtractionRequest(
          jobs = listOf(
            BatchJob(jobId = "alpha", pdfBase64 = pdfA),
            BatchJob(jobId = "bravo", pdfBase64 = pdfB),
          ),
        ),
      )
    }

    val ids = response.results.map { it.jobId }.toSet()
    assertTrue("alpha" in ids)
    assertTrue("bravo" in ids)
  }

  private fun reconcilingCreditCardLines(): List<String> = listOf(
    "chase.com",
    "Account Number 1111 2222 3333 4242",
    "Opening/Closing Date 04/01/26 - 04/30/26",
    "Payment Due Date: 05/25/26",
    "Minimum Payment Due: \$35.00",
    "Previous Balance \$1,000.00",
    "New Balance: \$1,050.00",
    "Payment, Credits -\$200.00",
    "Purchases \$250.00",
    "Fees Charged \$0.00",
    "Interest Charged \$0.00",
    "Transaction Description \$ Amount",
    "04/03 Coffee Shop 50.00",
    "04/18 Payment Thank You -200.00",
    "04/22 AMAZON MKTPL 200.00",
    "Total fees charged",
  )

  private fun base64Pdf(path: Path, lines: List<String>): String {
    writeTextPdf(path, lines)
    val bytes = Files.readAllBytes(path)
    return Base64.getEncoder().encodeToString(bytes)
  }

  private fun writeTextPdf(path: Path, lines: List<String>) {
    PDDocument().use { document ->
      val page = PDPage()
      document.addPage(page)
      PDPageContentStream(document, page).use { content ->
        content.beginText()
        content.setFont(PDType1Font(Standard14Fonts.FontName.HELVETICA), 10f)
        content.setLeading(14f)
        content.newLineAtOffset(48f, 740f)
        lines.forEach { line ->
          content.showText(line)
          content.newLine()
        }
        content.endText()
      }
      document.save(path.toFile())
    }
  }
}
