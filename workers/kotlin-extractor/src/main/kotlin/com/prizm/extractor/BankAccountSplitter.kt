package com.prizm.extractor

/**
 * One per-account block carved out of a (possibly combined) bank statement. Splitter consumers
 * downstream (labels, rows) work against [text] alone — they don't see the cover page or other
 * accounts.
 */
data class BankAccountSection(val accountNumber: String, val text: String) {
  /** Last 4 digits with whitespace squeezed out. */
  val accountLast4: String get() = accountNumber.filter(Char::isDigit).takeLast(4)
}

/**
 * Carves a bank statement's text into per-account sections by anchoring on
 * `"Account number: <digits with spaces>"` lines. Used for combined statements (one PDF holding
 * checking + savings) and harmless for single-account statements (returns one section).
 */
object BankAccountSplitter {
  fun split(text: String, layout: BankLayout): List<BankAccountSection> {
    val anchors = mutableListOf<Pair<IntRange, String>>()
    for (match in layout.accountAnchor.findAll(text)) {
      val accountNumber = match.groupValues[1].trim()
      // Skip the cover-page table where account numbers appear without the
      // "Account number:" prefix being the start of a real section. The cover anchor
      // is always followed by other account numbers on subsequent short lines, while a
      // real section anchor is followed by detail text within ~200 chars (e.g. "Your X").
      anchors += match.range to accountNumber
    }
    if (anchors.isEmpty()) {
      // Fall back to whole-text mode for non-combined statements where the only anchor
      // might live elsewhere. The engine will still try to extract metadata.
      return listOf(BankAccountSection(accountNumber = "", text = text))
    }

    val sections = mutableListOf<BankAccountSection>()
    for ((index, anchor) in anchors.withIndex()) {
      val start = anchor.first.first
      val end = if (index + 1 < anchors.size) anchors[index + 1].first.first else text.length
      val sectionText = text.substring(start, end)
      // Filter out cover-page or summary anchors that don't carry a real account block
      // (heuristic: must contain "Account summary" + "Beginning balance" + "Ending balance").
      if (
        sectionText.contains("Account summary", ignoreCase = true) &&
        sectionText.contains("Beginning balance", ignoreCase = true) &&
        sectionText.contains("Ending balance", ignoreCase = true)
      ) {
        sections += BankAccountSection(
          accountNumber = anchor.second,
          text = sectionText,
        )
      }
    }
    return sections.ifEmpty { listOf(BankAccountSection(accountNumber = "", text = text)) }
  }
}
