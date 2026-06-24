package com.prizm.extractor

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class BankAccountSplitterTest {
  private val layout = BankLayouts.forIssuer(LayoutKey.BANK_OF_AMERICA)

  @Test
  fun `slices a combined statement into per-account sections`() {
    val text = """
      |Your combined statement
      |for April 1, 2026 to April 30, 2026
      |Bank of America Adv Plus Banking 1111 2222 3333 4242 ${'$'}1,000.00 Page 3
      |Regular Savings 1111 2222 3333 9999 ${'$'}50.00 Page 7
      |Account number: 1111 2222 3333 4242
      |Account summary
      |Beginning balance on April 1, 2026 ${'$'}900.00
      |Ending balance on April 30, 2026 ${'$'}1,000.00
      |Deposits and other additions
      |Date Description Amount
      |Total deposits and other additions ${'$'}100.00
      |Account number: 1111 2222 3333 9999
      |Account summary
      |Beginning balance on April 1, 2026 ${'$'}40.00
      |Ending balance on April 30, 2026 ${'$'}50.00
      |Deposits and other additions
      |Date Description Amount
      |Total deposits and other additions ${'$'}10.00
    """.trimMargin()

    val sections = BankAccountSplitter.split(text, layout)
    assertEquals(2, sections.size)
    assertEquals("4242", sections[0].accountLast4)
    assertEquals("9999", sections[1].accountLast4)
    assertTrue(sections[0].text.contains("Account summary"))
  }

  @Test
  fun `returns a single section for a single-account statement`() {
    val text = """
      |Account number: 1111 2222 3333 4242
      |Account summary
      |Beginning balance on April 1, 2026 ${'$'}900.00
      |Ending balance on April 30, 2026 ${'$'}1,000.00
    """.trimMargin()
    val sections = BankAccountSplitter.split(text, layout)
    assertEquals(1, sections.size)
    assertEquals("4242", sections[0].accountLast4)
  }

  @Test
  fun `falls back to whole text when no anchor matches`() {
    val text = "no anchor here"
    val sections = BankAccountSplitter.split(text, layout)
    assertEquals(1, sections.size)
    assertEquals("", sections[0].accountLast4)
    assertEquals(text, sections[0].text)
  }
}
