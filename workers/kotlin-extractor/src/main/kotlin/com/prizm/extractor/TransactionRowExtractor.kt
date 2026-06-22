package com.prizm.extractor

object TransactionRowExtractor {
  fun extract(
    text: String,
    collapsedText: String,
    period: StatementPeriod,
    layout: CreditCardLayout,
  ): List<ExtractedRow> = when (val mode = layout.rowExtraction) {
    is RowExtraction.LineAnchored -> extractLineAnchored(text, period, mode)
    is RowExtraction.SectionScan -> extractSectionScan(collapsedText, period, mode)
  }

  private fun extractLineAnchored(
    text: String,
    period: StatementPeriod,
    mode: RowExtraction.LineAnchored,
  ): List<ExtractedRow> {
    val lines = text.lines().map { it.trim() }.filter { it.isNotEmpty() }
    val activityLines = mutableListOf<String>()
    var inActivity = false
    for (line in lines) {
      if (mode.startMarker(line)) {
        inActivity = true
        continue
      }
      if (inActivity && mode.endMarker(line)) break
      if (inActivity) activityLines += line
    }
    return activityLines.mapNotNull { line ->
      val match = mode.rowPattern.find(line) ?: return@mapNotNull null
      mode.parse(match, period)
    }
  }

  private fun extractSectionScan(
    collapsedText: String,
    period: StatementPeriod,
    mode: RowExtraction.SectionScan,
  ): List<ExtractedRow> = mode.sections.flatMap { section ->
    val sliced = sliceSection(collapsedText, section.startMarker, section.endMarker) ?: return@flatMap emptyList()
    mode.rowPattern.findAll(sliced).map { match -> mode.parse(match, period, section.sectionLabel) }.toList()
  }

  private fun sliceSection(text: String, startMarker: String, endMarker: String): String? {
    val startIndex = text.indexOf(startMarker, ignoreCase = true)
    if (startIndex < 0) return null
    val bodyStart = startIndex + startMarker.length
    val endIndex = text.indexOf(endMarker, startIndex = bodyStart, ignoreCase = true)
    if (endIndex < 0 || endIndex <= bodyStart) return null
    return text.substring(bodyStart, endIndex)
  }
}
