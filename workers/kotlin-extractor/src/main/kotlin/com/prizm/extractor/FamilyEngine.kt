package com.prizm.extractor

/**
 * Adapter for a statement family. [PdfStatementExtractor] selects an engine via a
 * `Map<StatementFamily, FamilyEngine>`; each engine owns extraction within its family.
 * Reconciliation math is hard-coded per family and lives behind a [Reconciler]: an
 * engine cannot override the math, only the layout that feeds it.
 *
 * [stageName] feeds [ExtractionLogger.stage] so per-family timing remains comparable
 * to the pre-refactor "credit-card-extract" stage label.
 */
interface FamilyEngine {
  val stageName: String

  fun extract(text: String, issuer: IssuerProfile?): ExtractionOutcome
}
