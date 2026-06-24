package com.prizm.extractor

import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.div
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.font.PDType1Font
import org.apache.pdfbox.pdmodel.font.Standard14Fonts
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.io.TempDir

class BankEngineBoaTest {
  @Test
  fun `extracts a Bank of America Adv Plus combined statement from a generated text PDF`(
    @TempDir tempDir: Path,
  ) {
    val fixture = tempDir / "boa-combined.pdf"
    writeTextPdf(fixture, boaCombinedTextLines())

    val result = PdfStatementExtractor().extract(fixture)

    assertEquals("succeeded", result.status, result.failureReason)
    val statement = assertNotNull(result.statements.singleOrNull())
    assertEquals("bank", statement.statementType)
    assertEquals("Bank of America", statement.bankName)
    assertEquals("9062", statement.accountLast4)
    assertEquals("2026-04-18", statement.periodStart)
    assertEquals("2026-05-15", statement.periodEnd)
    assertMoney(4339.25, statement.openingBalance)
    assertMoney(4402.20, statement.closingBalance)
    assertTrue(statement.reconciles, "primary account must reconcile: ${'$'}{statement.reportedTotal} vs ${'$'}{statement.computedTotal}")
    assertTrue(statement.ready)
    // 1 deposit + 2 subtractions in the trimmed-down committed fixture.
    assertEquals(3, statement.transactions.size)
    assertTrue(
      statement.transactions.any { it.description.contains("TRINET") && it.credit != null },
    )
    assertTrue(
      statement.transactions.any { it.description.contains("DUKE") && it.debit != null },
    )
    val savingsSummary = (statement.metadata["additionalAccounts"] as? List<*>)?.firstOrNull() as? Map<*, *>
    assertNotNull(savingsSummary, "savings should appear in additionalAccounts metadata")
    assertEquals("0857", savingsSummary["accountLast4"])
    assertTrue(statement.reviewFlags.contains("additional_accounts_detected"))
  }

  @Test
  fun `single-account bank statement reconciles without additionalAccounts flag`(
    @TempDir tempDir: Path,
  ) {
    val fixture = tempDir / "boa-single.pdf"
    writeTextPdf(fixture, boaSingleAccountTextLines())

    val result = PdfStatementExtractor().extract(fixture)
    assertEquals("succeeded", result.status, result.failureReason)
    val statement = assertNotNull(result.statements.singleOrNull())
    assertEquals("9062", statement.accountLast4)
    assertTrue(statement.reconciles)
    assertFalse(statement.reviewFlags.contains("additional_accounts_detected"))
  }

  @Test
  fun `local BOA combined fixture parses with full transaction coverage`() {
    val fixture = Path.of("fixtures-local") / "boa_combined_2026-05-15.pdf"
    assumeTrue(Files.exists(fixture), "Local PDF fixture is not present: $fixture")

    val result = PdfStatementExtractor().extract(fixture)
    assertEquals("succeeded", result.status, result.failureReason)
    val statement = assertNotNull(result.statements.singleOrNull())
    assertEquals("bank", statement.statementType)
    assertEquals("Bank of America", statement.bankName)
    assertEquals("9062", statement.accountLast4)
    assertMoney(4339.25, statement.openingBalance)
    assertMoney(4402.20, statement.closingBalance)
    assertTrue(statement.reconciles)
    // 7 deposits + 17 other subtractions = 24 transactions on the canonical statement.
    assertEquals(24, statement.transactions.size)
    assertTrue(statement.reviewFlags.contains("additional_accounts_detected"))
  }

  private fun boaCombinedTextLines(): List<String> = listOf(
    "Bank of America, N.A.",
    "Your combined statement",
    "for April 18, 2026 to May 15, 2026",
    "Account number: 8980 8127 9062",
    "Your Bank of America Adv Plus Banking",
    "Preferred Rewards Gold",
    "Account summary",
    "Beginning balance on April 18, 2026 \$4,339.25",
    "Ending balance on May 15, 2026 \$4,402.20",
    "Deposits and other additions",
    "Date Description Amount",
    "04/24/26 TRINET 04222026 DES:PAYROLL 2,241.80",
    "Total deposits and other additions \$2,241.80",
    "Other subtractions",
    "Date Description Amount",
    "04/21/26 DUKEENERGYCORPOR DES:WEB_PAY -169.71",
    "05/04/26 Mobile Banking payment to CRD 0903 -2,009.14",
    "Total other subtractions -\$2,178.85",
    "Account number: 8980 8128 0857",
    "Your Regular Savings",
    "Preferred Rewards Gold",
    "Account summary",
    "Beginning balance on April 18, 2026 \$40.04",
    "Ending balance on May 15, 2026 \$65.04",
    "Deposits and other additions",
    "Date Description Amount",
    "04/24/26 Automatic Transfer from CHK 9062 25.00",
    "Total deposits and other additions \$25.00",
  )

  private fun boaSingleAccountTextLines(): List<String> = listOf(
    "Bank of America, N.A.",
    "for April 18, 2026 to May 15, 2026",
    "Account number: 8980 8127 9062",
    "Your Bank of America Adv Plus Banking",
    "Account summary",
    "Beginning balance on April 18, 2026 \$1,000.00",
    "Ending balance on May 15, 2026 \$1,100.00",
    "Deposits and other additions",
    "Date Description Amount",
    "04/24/26 TRINET DES:PAYROLL 100.00",
    "Total deposits and other additions \$100.00",
  )

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

  private fun assertMoney(expected: Double, actual: Double?) {
    assertNotNull(actual)
    assertEquals(expected, actual, absoluteTolerance = 0.001)
  }
}
