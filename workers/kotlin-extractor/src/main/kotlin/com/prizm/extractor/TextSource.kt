package com.prizm.extractor

import java.nio.file.Path
import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper

/**
 * Source of selectable text from a PDF on disk. Multiple adapters compose a fallback chain:
 * [PdfStatementExtractor] tries each in order and returns [ExtractionOutcome.NoSelectableText]
 * only when every source returns null. ADR-009's fail-closed contract is honoured through
 * composition rather than a hard-coded check in the orchestrator.
 *
 * One adapter ships today, [SelectableTextSource]. OCR and LLM adapters plug into the same
 * slot when they land; the orchestrator does not change.
 */
interface TextSource {
  val name: String

  fun extract(path: Path): String?
}

/**
 * Loads selectable text via Apache PDFBox. Returns null when the document holds fewer than
 * 100 non-whitespace characters: that signal is the historical scanned-PDF detection from
 * the pre-refactor inlined check.
 */
class SelectableTextSource : TextSource {
  override val name: String = "pdfbox-selectable"

  override fun extract(path: Path): String? {
    val text = Loader.loadPDF(path.toFile()).use { document ->
      PDFTextStripper().getText(document)
    }
    return if (text.isBlank() || text.count { !it.isWhitespace() } < MIN_NON_WHITESPACE) null else text
  }

  companion object {
    private const val MIN_NON_WHITESPACE = 100
  }
}
