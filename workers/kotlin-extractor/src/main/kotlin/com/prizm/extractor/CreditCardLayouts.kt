package com.prizm.extractor

import java.time.LocalDate

data class ExtractedRow(
  val date: LocalDate,
  val description: String,
  val rawAmount: Double,
  val section: String,
  val reference: String? = null,
)

/**
 * Layout describes how a single issuer renders period and rows. It never changes which
 * reconciler runs or what a label means — only how the text is sliced. A new issuer that
 * follows an existing layout shape adds nothing.
 */
data class CreditCardLayout(
  val periodPatterns: List<PeriodPattern>,
  val rowExtraction: RowExtraction,
)

sealed class RowExtraction {
  data class LineAnchored(
    val startMarker: (String) -> Boolean,
    val endMarker: (String) -> Boolean,
    val rowPattern: Regex,
    val parse: (MatchResult, StatementPeriod) -> ExtractedRow,
  ) : RowExtraction()

  data class SectionScan(
    val sections: List<NamedSection>,
    val rowPattern: Regex,
    val parse: (MatchResult, StatementPeriod, String) -> ExtractedRow,
  ) : RowExtraction()
}

data class NamedSection(val startMarker: String, val endMarker: String, val sectionLabel: String)

object CreditCardLayouts {
  fun forIssuer(layoutKey: String?): CreditCardLayout =
    when (layoutKey) {
      LayoutKey.CHASE -> CHASE
      LayoutKey.BANK_OF_AMERICA -> BANK_OF_AMERICA
      LayoutKey.GENERIC -> GENERIC
      else -> GENERIC
    }

  /**
   * Best-effort layout for credit-card statements from issuers we haven't profiled. Section
   * markers, period patterns, and row regexes cover the common shapes used by Capital One,
   * Citi, Discover, Wells Fargo, US Bank, Amex, and most community-bank cards. Selecting this
   * layout causes the engine to raise the `unknown_issuer` review flag so reviewers verify
   * rows before exporting.
   */
  private val GENERIC = CreditCardLayout(
    periodPatterns = listOf(
      // "04/01/26 - 04/30/26" / "04/01/26 to 04/30/26"
      PeriodPattern(
        regex = Regex("""(\d{2}/\d{2}/\d{2})\s+(?:-|to|through)\s+(\d{2}/\d{2}/\d{2})"""),
        parse = ::parseSlashDateRange,
      ),
      // "04/01/2026 - 04/30/2026" / "04/01/2026 to 04/30/2026"
      PeriodPattern(
        regex = Regex("""(\d{1,2})/(\d{1,2})/(\d{4})\s+(?:-|to|through)\s+(\d{1,2})/(\d{1,2})/(\d{4})"""),
        parse = ::parseSlashFullYearDateRange,
      ),
      // "April 1, 2026 - April 30, 2026"
      PeriodPattern(
        regex = Regex("""([A-Za-z]+)\s+(\d{1,2})\s+-\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})"""),
        parse = ::parseMonthDateRange,
      ),
      // "April 1, 2026 to April 30, 2026"
      PeriodPattern(
        regex = Regex("""([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+(?:to|through)\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})"""),
        parse = ::parseMonthNameRange,
      ),
    ),
    rowExtraction = RowExtraction.SectionScan(
      sections = listOf(
        NamedSection("Payments and Other Credits", "Total Payments", "Payments and Credits"),
        NamedSection("Payments, Credits", "Total Payments", "Payments and Credits"),
        NamedSection("Payments/Credits", "Total Payments", "Payments and Credits"),
        NamedSection("Payments and Credits", "Total Payments", "Payments and Credits"),
        NamedSection("Payments", "Total Payments", "Payments and Credits"),
        NamedSection("Credits", "Total Credits", "Payments and Credits"),
        NamedSection("Purchases and Adjustments", "Total Purchases", "Purchases"),
        NamedSection("Purchases", "Total Purchases", "Purchases"),
        NamedSection("New Charges", "Total New Charges", "Purchases"),
        NamedSection("Charges", "Total Charges", "Purchases"),
        NamedSection("Transactions", "Total Transactions", "Purchases"),
      ),
      // "MM/DD <description> <amount>" — most permissive credit-card row shape.
      rowPattern = Regex(
        """^(\d{2})/(\d{2})(?:\s+\d{2}/\d{2})?\s+(.+?)\s+(-?\$?\d[\d,]*\.\d{2})$""",
      ),
      parse = { match, period, sectionLabel ->
        val date = dateInPeriod(match.groupValues[1].toInt(), match.groupValues[2].toInt(), period)
        val description = cleanDescriptionForCc(match.groupValues[3])
        val rawAmount = parseMoney(match.groupValues[4])
        ExtractedRow(date, description, rawAmount, sectionLabel, reference = null)
      },
    ),
  )

  private val CHASE = CreditCardLayout(
    periodPatterns = listOf(
      PeriodPattern(
        regex = Regex("""Opening/Closing Date\s+(\d{2}/\d{2}/\d{2})\s+-\s+(\d{2}/\d{2}/\d{2})"""),
        parse = ::parseSlashDateRange,
      ),
    ),
    rowExtraction = RowExtraction.LineAnchored(
      startMarker = { line ->
        line.contains("Transaction Description", ignoreCase = true) && line.contains("$ Amount")
      },
      endMarker = { line -> line.startsWith("Total fees charged", ignoreCase = true) },
      rowPattern = Regex(
        """^(\d{2})/(\d{2})\s+(.+?)\s+(-?(?:\d{1,3}(?:,\d{3})*|\d+|\.\d{1,2})(?:\.\d{2})?)$""",
      ),
      parse = { match, period ->
        val rawAmount = parseMoney(match.groupValues[4])
        val description = cleanDescription(match.groupValues[3])
        val date = dateInPeriod(match.groupValues[1].toInt(), match.groupValues[2].toInt(), period)
        val section = if (rawAmount < 0 || description.contains("payment", ignoreCase = true)) {
          "Payments and Credits"
        } else {
          "Purchases"
        }
        ExtractedRow(date, description, rawAmount, section)
      },
    ),
  )

  private val BANK_OF_AMERICA = CreditCardLayout(
    periodPatterns = listOf(
      PeriodPattern(
        regex = Regex("""([A-Za-z]+)\s+(\d{1,2})\s+-\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})"""),
        parse = ::parseMonthDateRange,
      ),
    ),
    rowExtraction = RowExtraction.SectionScan(
      sections = listOf(
        NamedSection("Payments and Other Credits", "TOTAL PAYMENTS", "Payments and Credits"),
        NamedSection("Purchases and Adjustments", "TOTAL PURCHASES", "Purchases"),
      ),
      rowPattern = Regex(
        """(\d{2})/(\d{2})\s+\d{2}/\d{2}\s+(.+?)\s+(\d{4})\s+\d{4}\s+(-?\d[\d,]*\.\d{2})""",
      ),
      parse = { match, period, sectionLabel ->
        val date = dateInPeriod(match.groupValues[1].toInt(), match.groupValues[2].toInt(), period)
        val description = cleanDescription(match.groupValues[3])
        val rawAmount = parseMoney(match.groupValues[5])
        val reference = match.groupValues[4]
        ExtractedRow(date, description, rawAmount, sectionLabel, reference)
      },
    ),
  )
}

private fun cleanDescription(value: String): String = value.replace(Regex("""\s+"""), " ").trim()

private fun cleanDescriptionForCc(value: String): String = cleanDescription(value)
