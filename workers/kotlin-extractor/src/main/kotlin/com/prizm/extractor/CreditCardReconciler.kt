package com.prizm.extractor

/**
 * Credit-card-family reconciliation math. Hard-coded. The reported total is the sum of the four
 * activity buckets the issuer prints (purchases, payments, fees, interest); the computed total is
 * the sum of signed transaction rows. Reconciles iff they match to the cent.
 *
 * This is the load-bearing rule the user agreed to: math here cannot be overridden by an
 * issuer-specific layout. A new issuer either fits this math or it does not belong in this family.
 */
data class CreditCardTotals(
  val previousBalance: Double,
  val newBalance: Double,
  val purchases: Double,
  val payments: Double,
  val fees: Double,
  val interest: Double,
)

data class CreditCardReconciliation(
  val reportedTotal: Double,
  val computedTotal: Double,
  val reconciles: Boolean,
)

object CreditCardReconciler {
  fun reportedTotal(totals: CreditCardTotals): Double =
    money(totals.purchases + totals.payments + totals.fees + totals.interest)

  fun computedTotal(transactions: List<ParsedTransaction>): Double =
    money(
      transactions.sumOf { transaction ->
        when {
          transaction.debit != null -> transaction.debit
          transaction.credit != null -> -transaction.credit
          else -> 0.0
        }
      },
    )

  fun reconcile(totals: CreditCardTotals, transactions: List<ParsedTransaction>): CreditCardReconciliation {
    val reported = reportedTotal(totals)
    val computed = computedTotal(transactions)
    return CreditCardReconciliation(reported, computed, reported == computed)
  }
}
