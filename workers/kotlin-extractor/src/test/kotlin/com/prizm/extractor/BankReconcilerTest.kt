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

  @Test
  fun `emits a discrepancy report with direction short when sum is below expected`() {
    val totals = BankTotals(beginningBalance = 100.00, endingBalance = 175.00)
    val rows = listOf(row(amount = 60.00))
    val result = BankReconciler.reconcile(totals, rows)

    assertFalse(result.reconciles)
    val report = result.report
    assertEquals(15.00, report.totalDelta, absoluteTolerance = 0.001)
    assertEquals(DiscrepancyDirection.SHORT, report.direction)
    assertTrue(
      report.summary.contains("\$15.00") && report.summary.contains("short", ignoreCase = true),
      "summary should plainly name the dollar amount and direction: ${'$'}{report.summary}",
    )
  }

  @Test
  fun `emits a discrepancy report with direction over when sum is above expected`() {
    val totals = BankTotals(beginningBalance = 100.00, endingBalance = 175.00)
    val rows = listOf(row(amount = 90.00))
    val result = BankReconciler.reconcile(totals, rows)

    assertFalse(result.reconciles)
    val report = result.report
    assertEquals(15.00, report.totalDelta, absoluteTolerance = 0.001)
    assertEquals(DiscrepancyDirection.OVER, report.direction)
    assertTrue(report.summary.contains("over", ignoreCase = true))
  }

  @Test
  fun `emits a matched report when reconciliation succeeds`() {
    val totals = BankTotals(beginningBalance = 100.00, endingBalance = 175.00)
    val rows = listOf(row(amount = 75.00))
    val result = BankReconciler.reconcile(totals, rows)

    assertTrue(result.reconciles)
    assertEquals(DiscrepancyDirection.MATCHED, result.report.direction)
    assertEquals(0.00, result.report.totalDelta, absoluteTolerance = 0.001)
  }

  private fun row(amount: Double): ExtractedRow =
    ExtractedRow(
      date = LocalDate.of(2026, 5, 1),
      description = "synthetic",
      rawAmount = amount,
      section = "Test",
    )
}
