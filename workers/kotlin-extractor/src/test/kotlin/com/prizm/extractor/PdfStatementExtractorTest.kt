package com.prizm.extractor

import java.nio.file.Files
import java.nio.file.Path
import java.time.LocalDate
import kotlin.io.path.div
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.io.TempDir
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.MethodSource
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage

class PdfStatementExtractorTest {
  @Test
  fun `extracts a reviewable Chase credit card statement from a selectable text PDF`() {
    val fixture = localFixtureDir() / "27BBC972-C930-4FA2-9CB5-016B380ABDE3-list.pdf"
    assumeTrue(Files.exists(fixture), "Local PDF fixture is not present: $fixture")

    val result = PdfStatementExtractor().extract(fixture)

    assertEquals("succeeded", result.status)
    val statement = assertNotNull(result.statements.singleOrNull())
    assertEquals("credit_card", statement.statementType)
    assertEquals("Chase", statement.bankName)
    assertFourDigitLast4(statement.accountLast4)
    assertValidPeriod(statement)
    assertNotNull(statement.openingBalance)
    assertNotNull(statement.closingBalance)
    assertMoney(assertNotNull(statement.reportedTotal), statement.computedTotal)
    assertTrue(statement.reconciles)
    assertTrue(statement.ready)
    assertTrue(statement.transactions.size >= 10)
    assertTrue(
      statement.transactions.any {
        it.description.contains("Payment Thank You", ignoreCase = true) && it.credit != null
      },
    )
    assertTrue(
      statement.transactions.any {
        it.description.contains("AMAZON MKTPL", ignoreCase = true) && it.debit != null
      },
    )
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("localPdfFixtures")
  fun `extracts normalized statements from supplied selectable text PDFs`(
    expectation: FixtureExpectation,
  ) {
    val fixture = localFixtureDir() / expectation.fileName
    assumeTrue(Files.exists(fixture), "Local PDF fixture is not present: $fixture")

    val result = PdfStatementExtractor().extract(fixture)

    assertEquals("succeeded", result.status)
    val statement = assertNotNull(result.statements.singleOrNull())
    assertEquals("credit_card", statement.statementType)
    assertEquals(expectation.bankName, statement.bankName)
    assertFourDigitLast4(statement.accountLast4)
    assertValidPeriod(statement)
    assertNotNull(statement.openingBalance)
    assertNotNull(statement.closingBalance)
    assertMoney(assertNotNull(statement.reportedTotal), statement.computedTotal)
    assertTrue(statement.reconciles)
    assertTrue(statement.ready)
    assertTrue(statement.reviewFlags.isEmpty())
    assertTrue(statement.transactions.size >= expectation.minimumTransactions)
  }

  @Test
  fun `fails closed when a PDF has no selectable text`(@TempDir tempDir: Path) {
    val imageOnlyStandIn = tempDir / "blank.pdf"
    PDDocument().use { document ->
      document.addPage(PDPage())
      document.save(imageOnlyStandIn.toFile())
    }

    val result = PdfStatementExtractor().extract(imageOnlyStandIn)

    assertEquals("failed", result.status)
    assertEquals(emptyList(), result.statements)
    assertTrue(result.failureReason!!.contains("Selectable text was not found"))
  }

  private fun localFixtureDir(): Path =
    Path.of(System.getenv("PRIZM_EXTRACTOR_PDF_FIXTURE_DIR") ?: "fixtures-local")

  private fun assertMoney(expected: Double, actual: Double?) {
    assertNotNull(actual)
    assertEquals(expected, actual, absoluteTolerance = 0.001)
  }

  private fun assertFourDigitLast4(accountLast4: String?) {
    assertNotNull(accountLast4)
    assertTrue(Regex("""\d{4}""").matches(accountLast4))
  }

  private fun assertValidPeriod(statement: ParsedStatement) {
    val periodStart = assertNotNull(statement.periodStart)
    val periodEnd = assertNotNull(statement.periodEnd)

    assertTrue(LocalDate.parse(periodStart).isBefore(LocalDate.parse(periodEnd)))
  }

  data class FixtureExpectation(
    val fileName: String,
    val bankName: String,
    val minimumTransactions: Int,
  ) {
    override fun toString(): String = fileName
  }

  companion object {
    @JvmStatic
    fun localPdfFixtures(): List<FixtureExpectation> = listOf(
      FixtureExpectation(
        fileName = "27BBC972-C930-4FA2-9CB5-016B380ABDE3-list.pdf",
        bankName = "Chase",
        minimumTransactions = 15,
      ),
      FixtureExpectation(
        fileName = "E2EDA9E3-BEB2-4DC2-B3BA-F4F6C71CA6DD-list.pdf",
        bankName = "Chase",
        minimumTransactions = 8,
      ),
      FixtureExpectation(
        fileName = "eStmt_2026-04-14.pdf",
        bankName = "Bank of America",
        minimumTransactions = 4,
      ),
      FixtureExpectation(
        fileName = "eStmt_2026-04-28.pdf",
        bankName = "Bank of America",
        minimumTransactions = 6,
      ),
    )
  }
}
