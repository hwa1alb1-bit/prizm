package com.prizm.extractor

import kotlin.test.Test
import kotlin.test.assertEquals

class StatementFamilyDetectorTest {
  @Test
  fun `detects credit card family from previous + new balance + payment due date`() {
    val text = "Previous Balance \$1,000.00\nNew Balance: \$1,050.00\nPayment Due Date: 05/25/26"
    assertEquals(StatementFamily.CreditCard, StatementFamilyDetector.detect(text))
  }

  @Test
  fun `detects credit card family from minimum payment due anchor`() {
    val text = "Previous Balance \$0.00\nNew Balance \$500.00\nMinimum Payment Due: \$35.00"
    assertEquals(StatementFamily.CreditCard, StatementFamilyDetector.detect(text))
  }

  @Test
  fun `detects bank family from beginning + ending balance + deposits`() {
    val text = "Beginning Balance \$0.00\nEnding Balance \$1,200.00\nDeposits and Other Credits"
    assertEquals(StatementFamily.Bank, StatementFamilyDetector.detect(text))
  }

  @Test
  fun `detects bank family from withdrawals anchor`() {
    val text = "Beginning Balance \$0.00\nEnding Balance \$900.00\nWithdrawals and Other Debits"
    assertEquals(StatementFamily.Bank, StatementFamilyDetector.detect(text))
  }

  @Test
  fun `returns Unknown when no family labels match`() {
    val text = "Random PDF content with no banking labels."
    assertEquals(StatementFamily.Unknown, StatementFamilyDetector.detect(text))
  }

  @Test
  fun `returns Unknown when only one core balance label is present`() {
    val text = "Previous Balance \$1,000.00\nPayment Due Date: 05/25/26"
    assertEquals(StatementFamily.Unknown, StatementFamilyDetector.detect(text))
  }
}
