package com.prizm.extractor

import kotlin.math.abs

/**
 * Reconciliation math for bank-family statements. The contract is dead simple compared to credit
 * cards: opening balance + sum of signed transaction amounts must equal the closing balance,
 * within a tight tolerance (penny rounding is acceptable; anything larger is a real drift).
 *
 * Beyond the boolean reconciles flag, [reconcile] also returns a [ReconciliationReport] that
 * names the direction of the drift (short, over, matched) and a plain-language summary the UI
 * can show without recomputing math.
 */
object BankReconciler {
  private const val TOLERANCE_CENTS = 0.011

  fun reconcile(totals: BankTotals, rows: List<ExtractedRow>): BankReconciliation {
    val computedTotal = money(rows.sumOf { it.rawAmount })
    val expectedTotal = money(totals.endingBalance - totals.beginningBalance)
    val signedDelta = money(expectedTotal - computedTotal)
    val totalDelta = money(abs(signedDelta))
    val reconciles = totalDelta <= TOLERANCE_CENTS
    val direction = when {
      reconciles -> DiscrepancyDirection.MATCHED
      signedDelta > 0 -> DiscrepancyDirection.SHORT
      else -> DiscrepancyDirection.OVER
    }
    return BankReconciliation(
      computedTotal = computedTotal,
      reportedTotal = expectedTotal,
      reconciles = reconciles,
      report = ReconciliationReport(
        totalDelta = totalDelta,
        direction = direction,
        summary = summaryFor(direction, totalDelta),
      ),
    )
  }

  private fun summaryFor(direction: DiscrepancyDirection, totalDelta: Double): String =
    when (direction) {
      DiscrepancyDirection.MATCHED -> "Balances reconcile."
      DiscrepancyDirection.SHORT ->
        "Extracted transactions sum to \$${"%.2f".format(totalDelta)} short of the statement total — likely a missing or undercounted row."
      DiscrepancyDirection.OVER ->
        "Extracted transactions sum to \$${"%.2f".format(totalDelta)} over the statement total — likely a duplicated row or an inverted sign."
    }
}

data class BankReconciliation(
  val computedTotal: Double,
  val reportedTotal: Double,
  val reconciles: Boolean,
  val report: ReconciliationReport,
)

data class ReconciliationReport(
  val totalDelta: Double,
  val direction: DiscrepancyDirection,
  val summary: String,
)

enum class DiscrepancyDirection {
  MATCHED,
  SHORT,
  OVER,
}
