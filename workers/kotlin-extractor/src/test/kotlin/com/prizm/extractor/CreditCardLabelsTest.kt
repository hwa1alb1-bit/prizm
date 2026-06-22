package com.prizm.extractor

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class CreditCardLabelsTest {
  @Test
  fun `optionalMoney returns first matching synonym in order`() {
    val text = "New Balance Total \$2,500.00 elsewhere New Balance: \$999.00"
    assertEquals(2500.0, CreditCardLabels.optionalMoney(text, CreditCardLabels.NEW_BALANCE))
  }

  @Test
  fun `optionalMoney falls through to a later synonym when earlier ones miss`() {
    val text = "New Balance: \$1,050.00"
    assertEquals(1050.0, CreditCardLabels.optionalMoney(text, CreditCardLabels.NEW_BALANCE))
  }

  @Test
  fun `optionalMoney returns null when no synonym matches`() {
    assertNull(CreditCardLabels.optionalMoney("nothing here", CreditCardLabels.PREVIOUS_BALANCE))
  }

  @Test
  fun `requireMoney throws MissingFieldException naming the field`() {
    val error = assertFailsWith<MissingFieldException> {
      CreditCardLabels.requireMoney("empty", CreditCardLabels.PURCHASES, "purchases")
    }
    assertEquals("purchases", error.field)
  }

  @Test
  fun `last4 extracts the trailing 4 digits of a masked account number`() {
    assertEquals("4242", CreditCardLabels.last4("Account Number 1111 2222 3333 4242"))
  }

  @Test
  fun `paymentDueDate parses Chase short year format`() {
    assertEquals("2026-05-25", CreditCardLabels.paymentDueDate("Payment Due Date: 05/25/26"))
  }

  @Test
  fun `paymentDueDate parses Bank of America full year format`() {
    assertEquals("2026-05-25", CreditCardLabels.paymentDueDate("Payment Due Date 05/25/2026"))
  }
}
