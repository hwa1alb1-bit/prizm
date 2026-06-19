package com.prizm.extractor

import java.nio.file.Path

/**
 * Single-PDF extraction orchestrator. Reads text through a [TextSource] chain (selectable
 * text today, OCR/LLM adapters slot in here later), detects the [StatementFamily] and
 * issuer, then hands off to the matching [FamilyEngine] from [engines].
 *
 * The pre-refactor `when (family)` switch is gone: a missing engine in the map yields
 * [ExtractionOutcome.UnsupportedLayout], preserving the historical wire response for
 * [StatementFamily.Unknown] and any family whose engine has not landed yet.
 */
class PdfStatementExtractor(
  private val engines: Map<StatementFamily, FamilyEngine> = defaultEngines(),
  private val textSources: List<TextSource> = listOf(SelectableTextSource()),
  private val logger: ExtractionLogger = ExtractionLogger.default(),
) {
  fun extract(path: Path, jobId: String = "local-${path.fileName}"): WorkerPollResponse =
    extractOutcome(path, jobId).toWorkerPollResponse(jobId)

  fun extractOutcome(path: Path, jobId: String = "local-${path.fileName}"): ExtractionOutcome =
    logger.runJob(jobId) {
      val text = stage("pdfbox-load") { firstAvailableText(path) }
        ?: return@runJob ExtractionOutcome.NoSelectableText
      val family = stage("family-detect") { StatementFamilyDetector.detect(text) }
      val issuer = stage("issuer-detect") { IssuerDetector.detect(text) }
      val engine = engines[family] ?: return@runJob ExtractionOutcome.UnsupportedLayout
      stage(engine.stageName) { engine.extract(text, issuer) }
    }

  private fun firstAvailableText(path: Path): String? =
    textSources.asSequence().mapNotNull { source -> source.extract(path) }.firstOrNull()

  companion object {
    fun defaultEngines(): Map<StatementFamily, FamilyEngine> = mapOf(
      StatementFamily.CreditCard to CreditCardEngine(),
      StatementFamily.Bank to BankEngine(),
    )
  }
}
