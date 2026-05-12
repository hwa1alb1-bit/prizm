package com.prizm.extractor

import java.math.BigDecimal
import java.math.RoundingMode
import java.nio.file.Path
import java.time.LocalDate
import java.time.Month
import java.time.format.DateTimeFormatter
import java.util.Locale
import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper

class PdfStatementExtractor {
  fun extract(path: Path, jobId: String = "local-${path.fileName}"): WorkerPollResponse {
    val text = extractSelectableText(path)
    if (text.isBlank() || text.count { !it.isWhitespace() } < 100) {
      return WorkerPollResponse(
        status = "failed",
        jobId = jobId,
        failureReason = "Selectable text was not found. Scanned or image-only PDFs are unsupported.",
      )
    }

    val statement = when {
      text.contains("chase.com", ignoreCase = true) -> parseChaseCreditCard(text)
      text.contains("Bank of America", ignoreCase = true) -> parseBankOfAmericaCreditCard(text)
      else -> null
    }

    return if (statement == null) {
      WorkerPollResponse(
        status = "failed",
        jobId = jobId,
        failureReason = "Unsupported text statement layout.",
      )
    } else {
      WorkerPollResponse(status = "succeeded", jobId = jobId, statements = listOf(statement))
    }
  }

  private fun extractSelectableText(path: Path): String =
    Loader.loadPDF(path.toFile()).use { document ->
      PDFTextStripper().getText(document)
    }

  private fun parseChaseCreditCard(text: String): ParsedStatement {
    val lines = text.lines().map { it.trim() }.filter { it.isNotEmpty() }
    val collapsed = collapse(text)
    val period = parseSlashDateRange(
      requireNotNull(
        Regex("""Opening/Closing Date\s+(\d{2}/\d{2}/\d{2})\s+-\s+(\d{2}/\d{2}/\d{2})""")
          .find(collapsed),
      ) { "Chase statement period was not found." },
    )
    val previousBalance = requireMoney(collapsed, """Previous Balance""")
    val newBalance = requireMoney(collapsed, """New Balance:?""")
    val paymentTotal = requireMoney(collapsed, """Payment,\s*Credits""")
    val purchaseTotal = requireMoney(collapsed, """Purchases""")
    val feeTotal = requireMoney(collapsed, """Fees Charged""")
    val interestTotal = requireMoney(collapsed, """Interest Charged""")
    val reportedTotal = money(purchaseTotal + paymentTotal + feeTotal + interestTotal)
    val transactions = parseChaseTransactions(lines, period)
    val computedTotal = computeCreditCardActivity(transactions)
    val reconciles = computedTotal == reportedTotal

    return ParsedStatement(
      statementType = "credit_card",
      bankName = "Chase",
      accountLast4 = last4(collapsed),
      periodStart = period.start.toString(),
      periodEnd = period.end.toString(),
      openingBalance = previousBalance,
      closingBalance = newBalance,
      reportedTotal = reportedTotal,
      computedTotal = computedTotal,
      reconciles = reconciles,
      ready = transactions.isNotEmpty() && reconciles,
      confidence = confidenceFor(transactions),
      reviewFlags = reviewFlagsFor(transactions, reconciles),
      metadata = mapOf(
        "issuer" to "Chase",
        "paymentDueDate" to optionalShortDate(collapsed, """Payment Due Date:?\s*(\d{2}/\d{2}/\d{2})"""),
        "minimumPaymentDue" to optionalMoney(collapsed, """Minimum Payment Due:?"""),
        "previousBalance" to previousBalance,
        "newBalance" to newBalance,
        "purchaseTotal" to purchaseTotal,
        "paymentTotal" to money(kotlin.math.abs(paymentTotal)),
        "feeTotal" to feeTotal,
        "interestTotal" to interestTotal,
      ).filterValues { it != null },
      transactions = transactions,
    )
  }

  private fun parseBankOfAmericaCreditCard(text: String): ParsedStatement {
    val collapsed = collapse(text)
    val period = parseMonthDateRange(
      requireNotNull(
        Regex("""([A-Za-z]+)\s+(\d{1,2})\s+-\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})""")
          .find(collapsed),
      ) { "Bank of America statement period was not found." },
    )
    val previousBalance = requireMoney(collapsed, """Previous Balance""")
    val newBalance = requireMoney(collapsed, """New Balance Total""")
    val paymentTotal = requireMoney(collapsed, """Payments and Other Credits""")
    val purchaseTotal = requireMoney(collapsed, """Purchases and Adjustments""")
    val feeTotal = requireMoney(collapsed, """Fees Charged""")
    val interestTotal = requireMoney(collapsed, """Interest Charged""")
    val reportedTotal = money(purchaseTotal + paymentTotal + feeTotal + interestTotal)
    val transactions = parseBankOfAmericaTransactions(collapsed, period)
    val computedTotal = computeCreditCardActivity(transactions)
    val reconciles = computedTotal == reportedTotal

    return ParsedStatement(
      statementType = "credit_card",
      bankName = "Bank of America",
      accountLast4 = last4(collapsed),
      periodStart = period.start.toString(),
      periodEnd = period.end.toString(),
      openingBalance = previousBalance,
      closingBalance = newBalance,
      reportedTotal = reportedTotal,
      computedTotal = computedTotal,
      reconciles = reconciles,
      ready = transactions.isNotEmpty() && reconciles,
      confidence = confidenceFor(transactions),
      reviewFlags = reviewFlagsFor(transactions, reconciles),
      metadata = mapOf(
        "issuer" to "Bank of America",
        "paymentDueDate" to optionalUsDate(collapsed, """Payment Due Date\s+(\d{2}/\d{2}/\d{4})"""),
        "minimumPaymentDue" to optionalMoney(collapsed, """Total Minimum Payment Due"""),
        "previousBalance" to previousBalance,
        "newBalance" to newBalance,
        "purchaseTotal" to purchaseTotal,
        "paymentTotal" to money(kotlin.math.abs(paymentTotal)),
        "feeTotal" to feeTotal,
        "interestTotal" to interestTotal,
      ).filterValues { it != null },
      transactions = transactions,
    )
  }

  private fun parseChaseTransactions(lines: List<String>, period: StatementPeriod): List<ParsedTransaction> {
    val transactionPattern =
      Regex("""^(\d{2})/(\d{2})\s+(.+?)\s+(-?(?:\d{1,3}(?:,\d{3})*|\d+|\.\d{1,2})(?:\.\d{2})?)$""")
    val activityLines = mutableListOf<String>()
    var inAccountActivity = false

    for (line in lines) {
      if (line.contains("Transaction Description", ignoreCase = true) && line.contains("$ Amount")) {
        inAccountActivity = true
        continue
      }
      if (inAccountActivity && line.startsWith("Total fees charged", ignoreCase = true)) break
      if (inAccountActivity) activityLines += line
    }

    return activityLines.mapNotNull { line ->
      val match = transactionPattern.find(line) ?: return@mapNotNull null
      val amount = parseMoney(match.groupValues[4])
      val description = cleanDescription(match.groupValues[3])
      val date = dateInPeriod(match.groupValues[1].toInt(), match.groupValues[2].toInt(), period)
      creditCardTransaction(
        date = date,
        description = description,
        rawAmount = amount,
        section = if (amount < 0 || description.contains("payment", ignoreCase = true)) {
          "Payments and Credits"
        } else {
          "Purchases"
        },
        reference = null,
      )
    }
  }

  private fun parseBankOfAmericaTransactions(
    collapsed: String,
    period: StatementPeriod,
  ): List<ParsedTransaction> {
    val payments = section(collapsed, "Payments and Other Credits", "TOTAL PAYMENTS")
      .flatMap { parseBankOfAmericaSection(it, period, "Payments and Credits") }
    val purchases = section(collapsed, "Purchases and Adjustments", "TOTAL PURCHASES")
      .flatMap { parseBankOfAmericaSection(it, period, "Purchases") }
    return payments + purchases
  }

  private fun parseBankOfAmericaSection(
    section: String,
    period: StatementPeriod,
    statementSection: String,
  ): List<ParsedTransaction> {
    val transactionPattern =
      Regex("""(\d{2})/(\d{2})\s+\d{2}/\d{2}\s+(.+?)\s+(\d{4})\s+\d{4}\s+(-?\d[\d,]*\.\d{2})""")
    return transactionPattern.findAll(section).map { match ->
      val date = dateInPeriod(match.groupValues[1].toInt(), match.groupValues[2].toInt(), period)
      creditCardTransaction(
        date = date,
        description = cleanDescription(match.groupValues[3]),
        rawAmount = parseMoney(match.groupValues[5]),
        section = statementSection,
        reference = match.groupValues[4],
      )
    }.toList()
  }

  private fun creditCardTransaction(
    date: LocalDate,
    description: String,
    rawAmount: Double,
    section: String,
    reference: String?,
  ): ParsedTransaction {
    val isCredit = rawAmount < 0 || section.contains("payment", ignoreCase = true)
    val normalized = money(kotlin.math.abs(rawAmount))
    return ParsedTransaction(
      date = date.toString(),
      description = description,
      amount = if (isCredit) normalized else -normalized,
      debit = if (isCredit) null else normalized,
      credit = if (isCredit) normalized else null,
      confidence = 0.94,
      statement_section = section,
      reference = reference,
    )
  }

  private fun computeCreditCardActivity(transactions: List<ParsedTransaction>): Double =
    money(
      transactions.sumOf { transaction ->
        when {
          transaction.debit != null -> transaction.debit
          transaction.credit != null -> -transaction.credit
          else -> 0.0
        }
      },
    )

  private fun confidenceFor(transactions: List<ParsedTransaction>): Confidence {
    val transactionConfidence = if (transactions.isEmpty()) 0.0 else 0.94
    val fields = 0.93
    return Confidence(
      overall = money((fields + transactionConfidence) / 2),
      fields = fields,
      transactions = transactionConfidence,
    )
  }

  private fun reviewFlagsFor(transactions: List<ParsedTransaction>, reconciles: Boolean): List<String> {
    val flags = mutableListOf<String>()
    if (transactions.isEmpty()) flags += "transactions_missing"
    if (!reconciles) flags += "reconciliation_mismatch"
    return flags
  }

  private fun section(collapsed: String, start: String, end: String): List<String> {
    val startIndex = collapsed.indexOf(start, ignoreCase = true)
    if (startIndex < 0) return emptyList()
    val bodyStart = startIndex + start.length
    val endIndex = collapsed.indexOf(end, startIndex = bodyStart, ignoreCase = true)
    if (endIndex < 0 || endIndex <= bodyStart) return emptyList()
    return listOf(collapsed.substring(bodyStart, endIndex))
  }

  private fun requireMoney(text: String, label: String): Double =
    requireNotNull(optionalMoney(text, label)) { "Money field not found: $label" }

  private fun optionalMoney(text: String, label: String): Double? =
    Regex("""$label\s*([+-]?\$?[\d,]+(?:\.\d{2})?)""", RegexOption.IGNORE_CASE)
      .find(text)
      ?.groupValues
      ?.get(1)
      ?.let(::parseMoney)

  private fun last4(text: String): String? =
    Regex("""(?:Account Number|Account#|Account number):?\s*(?:X{4}\s*){0,3}(?:\d{4}\s*){0,3}(\d{4})""", RegexOption.IGNORE_CASE)
      .find(text)
      ?.groupValues
      ?.get(1)

  private fun parseMoney(value: String): Double {
    val trimmed = value.trim()
    val negative = trimmed.contains("-") || (trimmed.startsWith("(") && trimmed.endsWith(")"))
    val digits = trimmed.replace(Regex("""[^0-9.]"""), "")
    val normalized = if (digits.startsWith(".")) "0$digits" else digits
    val amount = normalized.toDoubleOrNull() ?: 0.0
    return money(if (negative) -amount else amount)
  }

  private fun money(value: Double): Double =
    BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).toDouble()

  private fun optionalShortDate(text: String, pattern: String): String? =
    Regex(pattern, RegexOption.IGNORE_CASE).find(text)?.groupValues?.get(1)?.let {
      LocalDate.parse(it, DateTimeFormatter.ofPattern("MM/dd/yy")).toString()
    }

  private fun optionalUsDate(text: String, pattern: String): String? =
    Regex(pattern, RegexOption.IGNORE_CASE).find(text)?.groupValues?.get(1)?.let {
      LocalDate.parse(it, DateTimeFormatter.ofPattern("MM/dd/yyyy")).toString()
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
    val startMonth = month(match.groupValues[1])
    val endMonth = month(match.groupValues[3])
    val startYear = if (startMonth.value > endMonth.value) endYear - 1 else endYear
    return StatementPeriod(
      start = LocalDate.of(startYear, startMonth, match.groupValues[2].toInt()),
      end = LocalDate.of(endYear, endMonth, match.groupValues[4].toInt()),
    )
  }

  private fun month(value: String): Month =
    Month.valueOf(value.uppercase(Locale.US))

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

  private fun cleanDescription(value: String): String =
    value.replace(Regex("""\s+"""), " ").trim()

  private fun collapse(text: String): String =
    text.replace(Regex("""\s+"""), " ").trim()
}

private data class StatementPeriod(
  val start: LocalDate,
  val end: LocalDate,
)
