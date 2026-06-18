package com.prizm.extractor

import java.nio.file.Path
import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper

class PdfStatementExtractor(
  private val creditCardEngine: CreditCardEngine = CreditCardEngine(),
  private val logger: ExtractionLogger = ExtractionLogger.default(),
) {
  fun extract(path: Path, jobId: String = "local-${path.fileName}"): WorkerPollResponse =
    extractOutcome(path, jobId).toWorkerPollResponse(jobId)

  fun extractOutcome(path: Path, jobId: String = "local-${path.fileName}"): ExtractionOutcome =
    logger.runJob(jobId) {
      val text = stage("pdfbox-load") { extractSelectableText(path) }
      if (text.isBlank() || text.count { !it.isWhitespace() } < 100) {
        return@runJob ExtractionOutcome.NoSelectableText
      }
      val family = stage("family-detect") { StatementFamilyDetector.detect(text) }
      val issuer = stage("issuer-detect") { IssuerDetector.detect(text) }
      when (family) {
        StatementFamily.CreditCard -> stage("credit-card-extract") { creditCardEngine.extract(text, issuer) }
        StatementFamily.Bank, StatementFamily.Unknown -> ExtractionOutcome.UnsupportedLayout
      }
    }

  private fun extractSelectableText(path: Path): String =
    Loader.loadPDF(path.toFile()).use { document ->
      PDFTextStripper().getText(document)
    }
}
