package com.prizm.extractor

import java.time.LocalDate
import java.time.Month
import java.time.format.DateTimeFormatter
import java.util.Locale

data class StatementPeriod(val start: LocalDate, val end: LocalDate)

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

data class PeriodPattern(
  val regex: Regex,
  val parse: (MatchResult) -> StatementPeriod,
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
      else -> CHASE
    }

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

private fun parseSlashDateRange(match: MatchResult): StatementPeriod {
  val formatter = DateTimeFormatter.ofPattern("MM/dd/yy")
  return StatementPeriod(
    start = LocalDate.parse(match.groupValues[1], formatter),
    end = LocalDate.parse(match.groupValues[2], formatter),
  )
}

private fun parseMonthDateRange(match: MatchResult): StatementPeriod {
  val endYear = match.groupValues[5].toInt()
  val startMonth = Month.valueOf(match.groupValues[1].uppercase(Locale.US))
  val endMonth = Month.valueOf(match.groupValues[3].uppercase(Locale.US))
  val startYear = if (startMonth.value > endMonth.value) endYear - 1 else endYear
  return StatementPeriod(
    start = LocalDate.of(startYear, startMonth, match.groupValues[2].toInt()),
    end = LocalDate.of(endYear, endMonth, match.groupValues[4].toInt()),
  )
}

private fun dateInPeriod(month: Int, day: Int, period: StatementPeriod): LocalDate {
  val endYearCandidate = LocalDate.of(period.end.year, month, day)
  if (!endYearCandidate.isBefore(period.start) && !endYearCandidate.isAfter(period.end)) {
    return endYearCandidate
  }
  val startYearCandidate = LocalDate.of(period.start.year, month, day)
  if (!startYearCandidate.isBefore(period.start) && !startYearCandidate.isAfter(period.end)) {
    return startYearCandidate
  }
  return endYearCandidate
}

private fun cleanDescription(value: String): String = value.replace(Regex("""\s+"""), " ").trim()
