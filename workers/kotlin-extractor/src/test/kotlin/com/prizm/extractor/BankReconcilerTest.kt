package com.prizm.extractor

import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BankReconcilerTest {
  @Test
  fun `reconciles when opening + sum of rows equals closing`() {
    val totals = BankTotals(beginningBalance = 100.00, endingBalance = 175.00)
    val rows = listOf(
      row(amount = 200.00),
      row(amount = -125.00),
    )
    val result = BankReconciler.reconcile(totals, rows)
    assertEquals(75.00, result.computedTotal, absoluteTolerance = 0.001)
    assertEquals(75.00, result.reportedTotal, absoluteTolerance = 0.001)
    assertTrue(result.reconciles)
  }

  @Test
  fun `tolerates a penny of rounding drift`() {
    val totals = BankTotals(beginningBalance = 100.00, endingBalance = 175.00)
    val rows = listOf(row(amount = 75.01))
    val result = BankReconciler.reconcile(totals, rows)
    assertTrue(result.reconciles, "penny drift must be tolerated")
  }

  @Test
  fun `flags reconciliation mismatch when drift exceeds tolerance`() {
    val totals = BankTotals(beginningBalance = 100.00, endingBalance = 175.00)
    val rows = listOf(row(amount = 80.00))
    val result = BankReconciler.reconcile(totals, rows)
    assertFalse(result.reconciles)
  }

  private fun row(amount: Double): ExtractedRow =
    ExtractedRow(
      date = LocalDate.of(2026, 5, 1),
      description = "synthetic",
      rawAmount = amount,
      section = "Test",
    )
}
