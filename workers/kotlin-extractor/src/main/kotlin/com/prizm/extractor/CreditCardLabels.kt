package com.prizm.extractor

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/**
 * Label synonyms for credit-card reconciliation totals. Each list is ordered most-specific first
 * because [optionalMoney] returns on the first match. Adding a synonym never changes which math
 * runs — it only widens what we recognise as the same family-level total.
 */
object CreditCardLabels {
  // Synonyms ordered most-specific first because [optionalMoney] returns on the first match.
  // Profiled-issuer label sets stay narrow to avoid false positives on Chase/BOA PDFs whose
  // transaction descriptions may mention common synonym phrases (e.g. "Payments" appears in
  // transaction text). Generic-layout extraction uses [GENERIC_*] supersets injected through
  // its own layout module.
  val PREVIOUS_BALANCE = listOf("Previous Balance")
  val NEW_BALANCE = listOf("New Balance Total", "New Balance:?")
  val PAYMENTS = listOf("Payments and Other Credits", """Payment,\s*Credits""")
  val PURCHASES = listOf("Purchases and Adjustments", "Purchases")
  val FEES = listOf("Fees Charged")
  val INTEREST = listOf("Interest Charged")
  val MINIMUM_PAYMENT_DUE = listOf("Total Minimum Payment Due", "Minimum Payment Due:?")

  // Generic supersets — used only by the GENERIC layout's totals reader. Order: profiled
  // synonyms first (so a generic-routed PDF that still contains profiled labels reads them),
  // then broader phrasing for un-profiled issuers.
  val GENERIC_PREVIOUS_BALANCE = PREVIOUS_BALANCE + listOf(
    "Last Statement Balance",
    "Prior Balance",
    "Balance Forward",
  )
  val GENERIC_NEW_BALANCE = NEW_BALANCE + listOf(
    "Statement Balance",
    "Current Balance",
    "Total Balance",
  )
  val GENERIC_PAYMENTS = PAYMENTS + listOf(
    "Total Payments and Credits",
    "Payments, Credits",
    "Payments/Credits",
  )
  val GENERIC_PURCHASES = PURCHASES + listOf(
    "Total Purchases and Adjustments",
    "New Charges",
    "Total New Charges",
    "Charges",
  )
  val GENERIC_FEES = FEES + listOf("Total Fees", "Fees")
  val GENERIC_INTEREST = INTEREST + listOf("Total Interest", "Interest")

  private val PAYMENT_DUE_DATE = listOf(
    """Payment Due Date\s+(\d{2}/\d{2}/\d{4})""" to "MM/dd/yyyy",
    """Payment Due Date:?\s*(\d{2}/\d{2}/\d{2})""" to "MM/dd/yy",
  )

  private val ACCOUNT_LAST4 = Regex(
    """(?:Account Number|Account#|Account number):?\s*(?:X{4}\s*){0,3}(?:\d{4}\s*){0,3}(\d{4})""",
    RegexOption.IGNORE_CASE,
  )

  fun optionalMoney(text: String, synonyms: List<String>): Double? {
    for (synonym in synonyms) {
      val match = Regex("""$synonym\s*([+-]?\$?[\d,]+(?:\.\d{2})?)""", RegexOption.IGNORE_CASE).find(text)
      if (match != null) return parseMoney(match.groupValues[1])
    }
    return null
  }

  fun requireMoney(text: String, synonyms: List<String>, fieldName: String): Double =
    optionalMoney(text, synonyms) ?: throw MissingFieldException(fieldName)

  fun last4(text: String): String? = ACCOUNT_LAST4.find(text)?.groupValues?.get(1)

  fun paymentDueDate(text: String): String? {
    for ((pattern, format) in PAYMENT_DUE_DATE) {
      val match = Regex(pattern, RegexOption.IGNORE_CASE).find(text) ?: continue
      try {
        return LocalDate.parse(match.groupValues[1], DateTimeFormatter.ofPattern(format)).toString()
      } catch (_: DateTimeParseException) {
        continue
      }
    }
    return null
  }
}

internal class MissingFieldException(val field: String) : RuntimeException("Required field not found: $field")
