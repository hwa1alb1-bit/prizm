package com.prizm.extractor

/**
 * Credit-card-family reconciliation math. The reported total is the sum of the four activity
 * buckets the issuer prints (purchases, payments, fees, interest); the computed total is the
 * sum of signed transaction rows. Reconciles iff they match to the cent.
 *
 * The load-bearing rule: math here cannot be overridden by an issuer-specific layout. A new
 * issuer either fits this math or it does not belong in this family.
 */
data class CreditCardTotals(
  val previousBalance: Double,
  val newBalance: Double,
  val purchases: Double,
  val payments: Double,
  val fees: Double,
  val interest: Double,
)

object CreditCardReconciler : Reconciler<CreditCardTotals> {
  override fun reportedTotal(totals: CreditCardTotals): Double =
    money(totals.purchases + totals.payments + totals.fees + totals.interest)

  override fun computedTotal(transactions: List<ParsedTransaction>): Double =
    money(
      transactions.sumOf { transaction ->
        when {
          transaction.debit != null -> transaction.debit
          transaction.credit != null -> -transaction.credit
          else -> 0.0
        }
      },
    )

  override fun reconcile(totals: CreditCardTotals, transactions: List<ParsedTransaction>): ReconciliationResult {
    val reported = reportedTotal(totals)
    val computed = computedTotal(transactions)
    return ReconciliationResult(reported, computed, reported == computed)
  }
}
