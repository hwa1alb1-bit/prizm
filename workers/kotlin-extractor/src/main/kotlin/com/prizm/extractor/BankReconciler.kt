package com.prizm.extractor

import kotlin.math.abs

/**
 * Reconciliation math for bank-family statements. The contract is dead simple compared to credit
 * cards: opening balance + sum of signed transaction amounts must equal the closing balance,
 * within a tight tolerance (penny rounding is acceptable; anything larger is a real drift).
 */
object BankReconciler {
  private const val TOLERANCE_CENTS = 0.011

  fun reconcile(totals: BankTotals, rows: List<ExtractedRow>): BankReconciliation {
    val computedTotal = money(rows.sumOf { it.rawAmount })
    val expectedTotal = money(totals.endingBalance - totals.beginningBalance)
    val reconciles = abs(computedTotal - expectedTotal) <= TOLERANCE_CENTS
    return BankReconciliation(
      computedTotal = computedTotal,
      reportedTotal = expectedTotal,
      reconciles = reconciles,
    )
  }
}

data class BankReconciliation(
  val computedTotal: Double,
  val reportedTotal: Double,
  val reconciles: Boolean,
)
