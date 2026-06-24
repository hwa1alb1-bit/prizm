package com.prizm.extractor

import java.time.LocalDate
import java.time.Month
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Shared statement-period model + date parsers. Both family engines (credit-card and bank)
 * extract a period from the PDF text using regex variants; the variants live with each layout
 * because they encode issuer-specific phrasing, but the types and parsers live here so neither
 * family carries a duplicate of the other's helpers.
 */
data class StatementPeriod(val start: LocalDate, val end: LocalDate)

/**
 * One way a period might appear in a PDF: a regex that locates it and a callback that parses
 * the [MatchResult] into a [StatementPeriod]. A layout owns an ordered list of these and the
 * first match wins.
 */
data class PeriodPattern(
  val regex: Regex,
  val parse: (MatchResult) -> StatementPeriod,
)

/** "04/01/26 - 04/30/26" / "04/01/26 to 04/30/26" — MM/DD/YY pair. */
fun parseSlashDateRange(match: MatchResult): StatementPeriod {
  val formatter = DateTimeFormatter.ofPattern("MM/dd/yy")
  return StatementPeriod(
    start = LocalDate.parse(match.groupValues[1], formatter),
    end = LocalDate.parse(match.groupValues[2], formatter),
  )
}

/** "04/01/2026 - 04/30/2026" — MM/DD/YYYY pair with 6 capturing groups. */
fun parseSlashFullYearDateRange(match: MatchResult): StatementPeriod =
  StatementPeriod(
    start = LocalDate.of(
      match.groupValues[3].toInt(),
      match.groupValues[1].toInt(),
      match.groupValues[2].toInt(),
    ),
    end = LocalDate.of(
      match.groupValues[6].toInt(),
      match.groupValues[4].toInt(),
      match.groupValues[5].toInt(),
    ),
  )

/** "April 1 - April 30, 2026" — month-name pair with end-year only. */
fun parseMonthDateRange(match: MatchResult): StatementPeriod {
  val endYear = match.groupValues[5].toInt()
  val startMonth = Month.valueOf(match.groupValues[1].uppercase(Locale.US))
  val endMonth = Month.valueOf(match.groupValues[3].uppercase(Locale.US))
  val startYear = if (startMonth.value > endMonth.value) endYear - 1 else endYear
  return StatementPeriod(
    start = LocalDate.of(startYear, startMonth, match.groupValues[2].toInt()),
    end = LocalDate.of(endYear, endMonth, match.groupValues[4].toInt()),
  )
}

/** "April 1, 2026 to April 30, 2026" / "April 18, 2026 through May 15, 2026" — full month + year on both sides. */
fun parseMonthNameRange(match: MatchResult): StatementPeriod {
  val startMonth = Month.valueOf(match.groupValues[1].uppercase(Locale.US))
  val endMonth = Month.valueOf(match.groupValues[4].uppercase(Locale.US))
  return StatementPeriod(
    start = LocalDate.of(
      match.groupValues[3].toInt(),
      startMonth,
      match.groupValues[2].toInt(),
    ),
    end = LocalDate.of(
      match.groupValues[6].toInt(),
      endMonth,
      match.groupValues[5].toInt(),
    ),
  )
}

private val SLASH_YY_DATE_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("MM/dd/yy")
private val SLASH_YYYY_DATE_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("MM/dd/yyyy")

/**
 * Parse a row date that may be `MM/DD/YY` or `MM/DD/YYYY`. Two-digit years that land in the
 * wrong century get clamped to within a year of the statement period.
 */
fun parseRowDate(raw: String, period: StatementPeriod): LocalDate {
  val candidate = if (raw.length == 8) {
    LocalDate.parse(raw, SLASH_YY_DATE_FORMATTER)
  } else {
    LocalDate.parse(raw, SLASH_YYYY_DATE_FORMATTER)
  }
  return when {
    candidate.isBefore(period.start.minusYears(1)) -> candidate.plusYears(100)
    candidate.isAfter(period.end.plusYears(1)) -> candidate.minusYears(100)
    else -> candidate
  }
}

/**
 * Resolve a MM/DD row date into a [LocalDate] within the statement period. Useful for issuer
 * layouts (e.g. Chase) that print row dates without a year and rely on period context.
 */
fun dateInPeriod(month: Int, day: Int, period: StatementPeriod): LocalDate {
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
