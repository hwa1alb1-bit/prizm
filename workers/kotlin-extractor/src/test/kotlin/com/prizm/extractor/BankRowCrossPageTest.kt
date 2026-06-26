package com.prizm.extractor

import java.nio.file.Path
import kotlin.io.path.div
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.font.PDType1Font
import org.apache.pdfbox.pdmodel.font.Standard14Fonts
import org.junit.jupiter.api.io.TempDir

/**
 * Cross-page row continuity coverage. A transaction whose description begins on page N and
 * whose amount lands on page N+1 must come through as one row, with the description stitched
 * cleanly and free of interstitial junk (page headers, page footers, marketing banners,
 * disclaimer blocks). Regression coverage for the friction documented in the market research
 * report (§4.2 Multi-Page Layout Breaks and Row Splitting).
 */
class BankRowCrossPageTest {
  @Test
  fun `marketing banner between pages does not pollute the wrapped transaction description`(
    @TempDir tempDir: Path,
  ) {
    val fixture = tempDir / "boa-cross-page-marketing-banner.pdf"
    writeMultiPageTextPdf(
      fixture,
      page1Lines = boaPage1WithUnfinishedTransaction(),
      page2Lines = boaPage2WithContinuationAndMarketingBanner(),
    )

    val result = PdfStatementExtractor().extract(fixture)
    assertEquals("succeeded", result.status, result.failureReason)
    val statement = assertNotNull(result.statements.singleOrNull())
    assertTrue(statement.reconciles, "balance must reconcile: ${'$'}{statement.computedTotal} vs ${'$'}{statement.reportedTotal}")

    val amazon = statement.transactions.singleOrNull {
      it.description.startsWith("AMAZONWEBSERVICES")
    }
    assertNotNull(amazon, "expected one AMAZONWEBSERVICES row, got: ${'$'}{statement.transactions.map { it.description }}")

    // The marketing banner that sits between page 1 and page 2 must NOT be folded into the
    // description. Any of these substrings appearing in the row means the page boundary leaked
    // banner text into the transaction.
    val banned = listOf("Save time", "bankofamerica.com", "Member FDIC", "Equal Housing Lender")
    for (token in banned) {
      assertTrue(
        !amazon.description.contains(token, ignoreCase = true),
        "transaction description contains interstitial banner text '${'$'}token': ${'$'}{amazon.description}",
      )
    }

    // The legitimate continuation text from page 2 must be present and joined.
    assertTrue(
      amazon.description.contains("INVOICE", ignoreCase = true),
      "expected page-2 continuation text in description: ${'$'}{amazon.description}",
    )
    assertEquals(50.00, amazon.credit ?: Double.NaN, absoluteTolerance = 0.001)
  }

  private fun boaPage1WithUnfinishedTransaction(): List<String> = listOf(
    "Bank of America, N.A.",
    "Your combined statement",
    "for April 18, 2026 to May 15, 2026",
    "Account number: 8980 8127 9062",
    "Your Bank of America Adv Plus Banking",
    "Account summary",
    "Beginning balance on April 18, 2026 \$1,000.00",
    "Ending balance on May 15, 2026 \$1,050.00",
    "Deposits and other additions",
    "Date Description Amount",
    // Last data line on page 1: a transaction whose amount sits on page 2.
    "05/02/26 AMAZONWEBSERVICES MULTI-LINE",
    "Page 1 of 2",
  )

  private fun boaPage2WithContinuationAndMarketingBanner(): List<String> = listOf(
    // Page-2 header crumb (BOA-style).
    "JOHN DOE   !   Account # 8980 8127 9062   !   04/18/26 to 05/15/26",
    // Marketing banner. This is the text that must NOT leak into the prior row's description.
    "Save time. Bank online at bankofamerica.com",
    "Member FDIC. Equal Housing Lender",
    // Section-continued header + column header.
    "Deposits and other additions - continued",
    "Date Description Amount",
    // The amount belongs to the prior date 05/02/26, with an extra remainder string.
    "INVOICE #12345 PAYMENT TO MERCHANT 50.00",
    "Total deposits and other additions \$50.00",
    "Page 2 of 2",
  )

  private fun writeMultiPageTextPdf(path: Path, page1Lines: List<String>, page2Lines: List<String>) {
    PDDocument().use { document ->
      for (lines in listOf(page1Lines, page2Lines)) {
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
      }
      document.save(path.toFile())
    }
  }
}
