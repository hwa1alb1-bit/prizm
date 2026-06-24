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

class BankEngineGenericTest {
  @Test
  fun `extracts a Wells Fargo-shaped bank statement via the generic layout`(
    @TempDir tempDir: Path,
  ) {
    val fixture = tempDir / "wells-fargo.pdf"
    writeTextPdf(
      fixture,
      listOf(
        "wellsfargo.com",
        "Wells Fargo Bank, N.A.",
        "Statement period 04/01/2026 to 04/30/2026",
        "Account number: 1234 5678 9012 4242",
        "Account summary",
        "Beginning balance on April 1, 2026 \$1,000.00",
        "Ending balance on April 30, 2026 \$1,150.00",
        "Deposits and Credits",
        "Date Description Amount",
        "04/05/2026 PAYROLL DEPOSIT 500.00",
        "Total deposits \$500.00",
        "Withdrawals and Other Deductions",
        "Date Description Amount",
        "04/10/2026 RENT PAYMENT -350.00",
        "Total deductions -\$350.00",
      ),
    )

    val result = PdfStatementExtractor().extract(fixture)
    assertEquals("succeeded", result.status, result.failureReason)
    val statement = assertNotNull(result.statements.singleOrNull())
    assertEquals("bank", statement.statementType)
    assertEquals("Wells Fargo", statement.bankName)
    assertEquals("4242", statement.accountLast4)
    assertTrue(statement.reconciles)
    assertTrue(
      statement.reviewFlags.contains("unknown_issuer"),
      "generic-layout extractions must raise unknown_issuer flag",
    )
    assertEquals(2, statement.transactions.size)
    assertTrue(statement.transactions.any { it.credit == 500.00 })
    assertTrue(statement.transactions.any { it.debit == 350.00 })
  }

  @Test
  fun `extracts a USAA-shaped bank statement via the generic layout`(
    @TempDir tempDir: Path,
  ) {
    val fixture = tempDir / "usaa.pdf"
    writeTextPdf(
      fixture,
      listOf(
        "USAA Federal Savings Bank",
        "Statement period 03/01/2026 - 03/31/2026",
        "Account number: 9876 5432 1098 8888",
        "Account summary",
        "Beginning Balance \$2,000.00",
        "Ending Balance \$1,850.00",
        "Deposits",
        "Date Description Amount",
        "03/15/2026 ACH CREDIT 100.00",
        "Total deposits \$100.00",
        "Withdrawals",
        "Date Description Amount",
        "03/10/2026 GROCERIES -150.00",
        "03/20/2026 GAS -100.00",
        "Total withdrawals -\$250.00",
      ),
    )

    val result = PdfStatementExtractor().extract(fixture)
    assertEquals("succeeded", result.status, result.failureReason)
    val statement = assertNotNull(result.statements.singleOrNull())
    assertEquals("USAA", statement.bankName)
    assertEquals("8888", statement.accountLast4)
    assertTrue(statement.reconciles)
    assertTrue(statement.reviewFlags.contains("unknown_issuer"))
    assertEquals(3, statement.transactions.size)
  }

  @Test
  fun `BOA fixture still reconciles via precision layout and does NOT raise unknown_issuer`(
    @TempDir tempDir: Path,
  ) {
    val fixture = tempDir / "boa.pdf"
    writeTextPdf(
      fixture,
      listOf(
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
      ),
    )

    val result = PdfStatementExtractor().extract(fixture)
    assertEquals("succeeded", result.status, result.failureReason)
    val statement = assertNotNull(result.statements.singleOrNull())
    assertEquals("Bank of America", statement.bankName)
    assertEquals(
      false,
      statement.reviewFlags.contains("unknown_issuer"),
      "BOA precision layout must not raise unknown_issuer",
    )
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
