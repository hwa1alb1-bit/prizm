package com.prizm.extractor

object PeriodExtractor {
  fun extract(collapsedText: String, layout: CreditCardLayout): StatementPeriod? {
    for (pattern in layout.periodPatterns) {
      val match = pattern.regex.find(collapsedText) ?: continue
      return pattern.parse(match)
    }
    return null
  }
}
