package com.prizm.extractor

import java.time.LocalDate
import kotlin.math.abs

/**
 * Walks a per-account section's text line-by-line and emits one [ExtractedRow] per transaction,
 * honouring BOA's multi-line wrapped descriptions ("Date Description CO\n   ID:XXX PPD\n
 * amount" patterns) and the section sign convention (deposits +, subtractions −, regardless of
 * how the amount is printed).
 */
object BankRowExtractor {
  fun extract(
    sectionText: String,
    period: StatementPeriod,
    layout: BankLayout,
  ): List<ExtractedRow> {
    val rows = mutableListOf<ExtractedRow>()
    val lines = sectionText.lines().map { it.trim() }

    for (section in layout.sections) {
      val sectionRows = extractFromSection(lines, period, layout, section)
      rows += sectionRows
    }
    return rows
  }

  private fun extractFromSection(
    lines: List<String>,
    period: StatementPeriod,
    layout: BankLayout,
    section: BankSection,
  ): List<ExtractedRow> {
    val rows = mutableListOf<ExtractedRow>()
    var inSection = false
    var pendingDate: LocalDate? = null
    var pendingDescription = StringBuilder()

    fun commit(absoluteAmount: Double) {
      val date = pendingDate ?: return
      val description = pendingDescription.toString().replace(Regex("""\s+"""), " ").trim()
      if (description.isEmpty()) return
      rows += ExtractedRow(
        date = date,
        description = description,
        rawAmount = money(abs(absoluteAmount) * section.signMultiplier),
        section = section.label,
      )
      pendingDate = null
      pendingDescription = StringBuilder()
    }

    var i = 0
    while (i < lines.size) {
      val line = lines[i]
      if (!inSection) {
        if (section.startMarker.matches(line)) inSection = true
        i++
        continue
      }
      if (section.endMarker.containsMatchIn(line)) break
      if (line.isEmpty() || isHeaderLine(line) || isPageFooter(line)) {
        i++
        continue
      }

      val dateMatch = layout.rowDatePattern.find(line)
      if (dateMatch != null) {
        // New row anchor — discard any in-flight row that never found its amount.
        pendingDate = parseRowDate(dateMatch.groupValues[1], period)
        pendingDescription = StringBuilder()
        val rest = dateMatch.groupValues[2]
        val trailing = trailingAmountOrNull(rest)
        if (trailing != null) {
          pendingDescription.append(trailing.descriptionRemainder)
          commit(trailing.amount)
        } else {
          pendingDescription.append(rest)
        }
      } else if (pendingDate != null) {
        if (layout.amountPattern.matches(line)) {
          commit(parseMoney(line))
        } else {
          val trailing = trailingAmountOrNull(line)
          if (trailing != null) {
            if (trailing.descriptionRemainder.isNotEmpty()) {
              if (pendingDescription.isNotEmpty()) pendingDescription.append(' ')
              pendingDescription.append(trailing.descriptionRemainder)
            }
            commit(trailing.amount)
          } else {
            if (pendingDescription.isNotEmpty()) pendingDescription.append(' ')
            pendingDescription.append(line)
          }
        }
      }
      i++
    }
    return rows
  }

  private fun isHeaderLine(line: String): Boolean {
    if (line.equals("Date Description Amount", ignoreCase = true)) return true
    if (line.equals("continued on the next page", ignoreCase = true)) return true
    if (line.startsWith("Deposits and other additions - continued", ignoreCase = true)) return true
    if (line.startsWith("Withdrawals and other subtractions", ignoreCase = true)) return true
    return false
  }

  private fun isPageFooter(line: String): Boolean {
    if (line.startsWith("Page ", ignoreCase = true) && line.contains(" of ")) return true
    // Page-header crumb like "<NAME>   !   Account # XXXX   !   <date> to <date>"
    if (line.contains("   !   ", ignoreCase = false)) return true
    return false
  }
}

private data class TrailingAmount(val amount: Double, val descriptionRemainder: String)

private val TRAILING_AMOUNT_PATTERN = Regex("""^(.*?)\s+(-?\$?[\d,]+\.\d{2})\s*$""")

private fun trailingAmountOrNull(line: String): TrailingAmount? {
  val match = TRAILING_AMOUNT_PATTERN.matchEntire(line) ?: return null
  val remainder = match.groupValues[1].trim()
  if (remainder.isEmpty()) return null
  return TrailingAmount(
    amount = abs(parseMoney(match.groupValues[2])),
    descriptionRemainder = remainder,
  )
}
