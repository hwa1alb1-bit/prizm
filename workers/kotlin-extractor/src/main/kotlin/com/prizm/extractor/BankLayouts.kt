package com.prizm.extractor

import java.time.LocalDate
import java.time.Month
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Bank-family layout. Describes how a single issuer renders period dates, account anchors,
 * balance labels, transaction-section markers, and row patterns. Identity affects only metadata;
 * layout affects only how text is sliced. Reconciliation math is hard-coded in [BankReconciler]
 * and is not parameterized by layout.
 */
data class BankLayout(
  /** Regex variants for "April 18, 2026 to May 15, 2026" style period strings. */
  val periodPatterns: List<BankPeriodPattern>,
  /** Section markers under which transaction rows are listed, in order. */
  val sections: List<BankSection>,
  /** Regex that anchors the start of a per-account block. */
  val accountAnchor: Regex,
  /** Beginning-balance label. */
  val beginningBalanceLabel: Regex,
  /** Ending-balance label. */
  val endingBalanceLabel: Regex,
  /** Pattern that matches MM/DD/YY at the start of a row. */
  val rowDatePattern: Regex,
  /** Pattern that matches a money value (with optional leading sign, thousands separators). */
  val amountPattern: Regex,
)

data class BankPeriodPattern(
  val regex: Regex,
  val parse: (MatchResult) -> StatementPeriod,
)

/**
 * One transaction section inside a per-account block (e.g. "Deposits and other additions" or
 * "Other subtractions"). [signMultiplier] applies to printed amounts regardless of their
 * printed sign — deposits are always +, debit-side sections are always −.
 */
data class BankSection(
  val startMarker: Regex,
  val endMarker: Regex,
  val label: String,
  val signMultiplier: Int,
)

object BankLayouts {
  fun forIssuer(layoutKey: String?): BankLayout =
    when (layoutKey) {
      LayoutKey.BANK_OF_AMERICA -> BANK_OF_AMERICA
      else -> BANK_OF_AMERICA
    }

  private val BANK_OF_AMERICA = BankLayout(
    periodPatterns = listOf(
      // "April 18, 2026 to May 15, 2026"
      BankPeriodPattern(
        regex = Regex("""([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+to\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})"""),
        parse = ::parseMonthNameRange,
      ),
      // "for April 18, 2026 to May 15, 2026" (cover page variant — anchor is on previous line, regex above matches)
    ),
    sections = listOf(
      BankSection(
        startMarker = Regex("""^Deposits and other additions(?: - continued)?$""", RegexOption.IGNORE_CASE),
        endMarker = Regex("""^Total deposits and other additions""", RegexOption.IGNORE_CASE),
        label = "Deposits and other additions",
        signMultiplier = 1,
      ),
      BankSection(
        startMarker = Regex("""^Other subtractions$""", RegexOption.IGNORE_CASE),
        endMarker = Regex("""^Total other subtractions""", RegexOption.IGNORE_CASE),
        label = "Other subtractions",
        signMultiplier = -1,
      ),
      BankSection(
        startMarker = Regex("""^ATM and debit card subtractions$""", RegexOption.IGNORE_CASE),
        endMarker = Regex("""^Total ATM and debit card subtractions""", RegexOption.IGNORE_CASE),
        label = "ATM and debit card subtractions",
        signMultiplier = -1,
      ),
      BankSection(
        startMarker = Regex("""^Checks$""", RegexOption.IGNORE_CASE),
        endMarker = Regex("""^Total checks""", RegexOption.IGNORE_CASE),
        label = "Checks",
        signMultiplier = -1,
      ),
      BankSection(
        startMarker = Regex("""^Service fees$""", RegexOption.IGNORE_CASE),
        endMarker = Regex("""^Total service fees""", RegexOption.IGNORE_CASE),
        label = "Service fees",
        signMultiplier = -1,
      ),
    ),
    accountAnchor = Regex("""Account number:\s*([\d\s]+)""", RegexOption.IGNORE_CASE),
    beginningBalanceLabel = Regex("""Beginning balance on .+?\s+\$?(-?[\d,]+\.\d{2})""", RegexOption.IGNORE_CASE),
    endingBalanceLabel = Regex("""Ending balance on .+?\s+\$?(-?[\d,]+\.\d{2})""", RegexOption.IGNORE_CASE),
    rowDatePattern = Regex("""^(\d{2}/\d{2}/\d{2})\s+(.*)$"""),
    amountPattern = Regex("""^-?[\d,]+\.\d{2}$"""),
  )
}

private fun parseMonthNameRange(match: MatchResult): StatementPeriod {
  val startMonth = Month.valueOf(match.groupValues[1].uppercase(Locale.US))
  val startDay = match.groupValues[2].toInt()
  val startYear = match.groupValues[3].toInt()
  val endMonth = Month.valueOf(match.groupValues[4].uppercase(Locale.US))
  val endDay = match.groupValues[5].toInt()
  val endYear = match.groupValues[6].toInt()
  return StatementPeriod(
    start = LocalDate.of(startYear, startMonth, startDay),
    end = LocalDate.of(endYear, endMonth, endDay),
  )
}

internal object BankPeriodExtractor {
  fun extract(text: String, layout: BankLayout): StatementPeriod? {
    for (pattern in layout.periodPatterns) {
      val match = pattern.regex.find(text) ?: continue
      return pattern.parse(match)
    }
    return null
  }
}

private val SLASH_DATE_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("MM/dd/yy")

internal fun parseSlashYyDate(raw: String, period: StatementPeriod): LocalDate {
  val candidate = LocalDate.parse(raw, SLASH_DATE_FORMATTER)
  // Two-digit years can land in the wrong century — clamp to the statement period when needed.
  return when {
    candidate.isBefore(period.start.minusYears(1)) -> candidate.plusYears(100)
    candidate.isAfter(period.end.plusYears(1)) -> candidate.minusYears(100)
    else -> candidate
  }
}
