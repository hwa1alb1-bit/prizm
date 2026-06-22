package com.prizm.extractor

/**
 * Reconciliation math for one statement family. [reportedTotal] reads the family's printed
 * totals; [computedTotal] sums signed transaction rows. Reconciles iff the two match to the
 * cent.
 *
 * Generic over [T] so each family keeps a specific totals type. There is no shared `Totals`
 * supertype because the math itself differs per family, the only thing the interface enforces
 * is the shape: reported vs computed vs verdict.
 *
 * The interface is the test surface. Contract tests target this directly, separate from the
 * engine that wraps it.
 */
interface Reconciler<T> {
  fun reportedTotal(totals: T): Double

  fun computedTotal(transactions: List<ParsedTransaction>): Double

  fun reconcile(totals: T, transactions: List<ParsedTransaction>): ReconciliationResult
}

data class ReconciliationResult(
  val reportedTotal: Double,
  val computedTotal: Double,
  val reconciles: Boolean,
)
