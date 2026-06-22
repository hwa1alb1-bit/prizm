package com.prizm.extractor

import java.nio.file.Path
import kotlin.io.path.div
import kotlin.test.Test
import kotlin.test.assertEquals
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.font.PDType1Font
import org.apache.pdfbox.pdmodel.font.Standard14Fonts
import org.junit.jupiter.api.io.TempDir

class FamilyEngineMapTest {
  @Test
  fun `routes credit-card family text to the credit-card engine in the map`(@TempDir tempDir: Path) {
    val fixture = tempDir / "credit-card.pdf"
    writeTextPdf(fixture, creditCardLines())
    val captured = mutableListOf<StatementFamily>()
    val engines = mapOf(
      StatementFamily.CreditCard to RecordingEngine(StatementFamily.CreditCard, captured),
      StatementFamily.Bank to RecordingEngine(StatementFamily.Bank, captured),
    )

    PdfStatementExtractor(engines = engines).extractOutcome(fixture)

    assertEquals(listOf(StatementFamily.CreditCard), captured)
  }

  @Test
  fun `routes bank family text to the bank engine in the map`(@TempDir tempDir: Path) {
    val fixture = tempDir / "bank.pdf"
    writeTextPdf(fixture, bankLines())
    val captured = mutableListOf<StatementFamily>()
    val engines = mapOf(
      StatementFamily.CreditCard to RecordingEngine(StatementFamily.CreditCard, captured),
      StatementFamily.Bank to RecordingEngine(StatementFamily.Bank, captured),
    )

    PdfStatementExtractor(engines = engines).extractOutcome(fixture)

    assertEquals(listOf(StatementFamily.Bank), captured)
  }

  @Test
  fun `returns UnsupportedLayout when no engine is registered for the detected family`(@TempDir tempDir: Path) {
    val fixture = tempDir / "credit-card.pdf"
    writeTextPdf(fixture, creditCardLines())
    val emptyEngines = emptyMap<StatementFamily, FamilyEngine>()

    val outcome = PdfStatementExtractor(engines = emptyEngines).extractOutcome(fixture)

    assertEquals(ExtractionOutcome.UnsupportedLayout, outcome)
  }

  @Test
  fun `returns NoSelectableText when every TextSource returns null`(@TempDir tempDir: Path) {
    val fixture = tempDir / "ignored.pdf"
    writeTextPdf(fixture, creditCardLines())
    val emptySources = listOf<TextSource>(NullTextSource(), NullTextSource())

    val outcome = PdfStatementExtractor(textSources = emptySources).extractOutcome(fixture)

    assertEquals(ExtractionOutcome.NoSelectableText, outcome)
  }

  @Test
  fun `uses the first TextSource that returns non-null text`(@TempDir tempDir: Path) {
    val fixture = tempDir / "ignored.pdf"
    writeTextPdf(fixture, listOf("ignored fixture text"))
    val syntheticCreditCardText = creditCardLines().joinToString("\n")
    val captured = mutableListOf<StatementFamily>()
    val engines = mapOf(
      StatementFamily.CreditCard to RecordingEngine(StatementFamily.CreditCard, captured),
    )
    val sources = listOf<TextSource>(NullTextSource(), StaticTextSource(syntheticCreditCardText))

    PdfStatementExtractor(engines = engines, textSources = sources).extractOutcome(fixture)

    assertEquals(listOf(StatementFamily.CreditCard), captured)
  }

  private fun creditCardLines(): List<String> = listOf(
    "Previous Balance \$0.00",
    "New Balance: \$0.00",
    "Payment Due Date: 05/25/26",
    "Minimum Payment Due: \$0.00",
    "Account ending in 1234, statement period 04/01-04/30 reference for the test fixture.",
  )

  private fun bankLines(): List<String> = listOf(
    "Beginning Balance \$0.00",
    "Ending Balance \$0.00",
    "Total Deposits and Other Credits \$0.00",
    "Total Withdrawals and Other Debits \$0.00",
    "Account ending in 5678, statement period 04/01-04/30 reference for the test fixture.",
  )

  private class RecordingEngine(
    private val family: StatementFamily,
    private val captured: MutableList<StatementFamily>,
  ) : FamilyEngine {
    override val stageName: String = "${family.name.lowercase()}-recording"

    override fun extract(text: String, issuer: IssuerProfile?): ExtractionOutcome {
      captured += family
      return ExtractionOutcome.UnsupportedLayout
    }
  }

  private class NullTextSource : TextSource {
    override val name: String = "null-source"

    override fun extract(path: Path): String? = null
  }

  private class StaticTextSource(private val text: String) : TextSource {
    override val name: String = "static-source"

    override fun extract(path: Path): String = text
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
