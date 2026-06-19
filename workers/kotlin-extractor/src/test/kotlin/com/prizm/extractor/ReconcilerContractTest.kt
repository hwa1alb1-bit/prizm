package com.prizm.extractor

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Targets the [Reconciler] interface directly via [CreditCardReconciler]. The interface is the
 * test surface: a future [BankReconciler] adapter must pass an equivalent contract suite, and
 * any new family adapter starts from these expectations.
 */
class ReconcilerContractTest {
  private val reconciler: Reconciler<CreditCardTotals> = CreditCardReconciler

  @Test
  fun `reportedTotal sums purchases payments fees interest to the cent`() {
    val totals = CreditCardTotals(
      previousBalance = 1000.0,
      newBalance = 1050.0,
      purchases = 250.0,
      payments = -200.0,
      fees = 0.0,
      interest = 0.0,
    )

    assertEquals(50.0, reconciler.reportedTotal(totals))
  }

  @Test
  fun `computedTotal sums signed debit and credit rows`() {
    val transactions = listOf(
      txn(debit = 50.0),
      txn(credit = 200.0),
      txn(debit = 200.0),
    )

    assertEquals(50.0, reconciler.computedTotal(transactions))
  }

  @Test
  fun `reconcile flags equal-to-the-cent totals as reconciling`() {
    val totals = CreditCardTotals(0.0, 0.0, 250.0, -200.0, 0.0, 0.0)
    val transactions = listOf(txn(debit = 50.0), txn(credit = 200.0), txn(debit = 200.0))

    val result = reconciler.reconcile(totals, transactions)

    assertEquals(50.0, result.reportedTotal)
    assertEquals(50.0, result.computedTotal)
    assertTrue(result.reconciles)
  }

  @Test
  fun `reconcile flags single-cent divergence as not reconciling`() {
    val totals = CreditCardTotals(0.0, 0.0, 250.01, -200.0, 0.0, 0.0)
    val transactions = listOf(txn(debit = 50.0), txn(credit = 200.0), txn(debit = 200.0))

    val result = reconciler.reconcile(totals, transactions)

    assertFalse(result.reconciles)
  }

  private fun txn(debit: Double? = null, credit: Double? = null): ParsedTransaction =
    ParsedTransaction(
      date = "2026-04-01",
      description = "test",
      amount = if (debit != null) -debit else (credit ?: 0.0),
      confidence = 0.0,
      debit = debit,
      credit = credit,
    )
}
