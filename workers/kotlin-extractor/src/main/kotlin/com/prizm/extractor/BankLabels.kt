package com.prizm.extractor

/**
 * Account-summary totals scraped from the top of a per-account block.
 */
data class BankTotals(
  val beginningBalance: Double,
  val endingBalance: Double,
)

/**
 * Label extractors for bank-family account sections. Each function operates on the per-account
 * text slice produced by [BankAccountSplitter]; none of them need to know about combined
 * statements or other accounts.
 */
object BankLabels {
  fun readTotals(sectionText: String, layout: BankLayout): BankTotals {
    val beginning = layout.beginningBalanceLabel.find(sectionText)
      ?.groupValues?.get(1)
      ?.let(::parseMoney)
      ?: throw MissingFieldException("beginningBalance")
    val ending = layout.endingBalanceLabel.find(sectionText)
      ?.groupValues?.get(1)
      ?.let(::parseMoney)
      ?: throw MissingFieldException("endingBalance")
    return BankTotals(beginning, ending)
  }
}
