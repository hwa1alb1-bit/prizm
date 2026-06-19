package com.prizm.extractor

/**
 * Bank-family engine stub. Ships in the [PdfStatementExtractor] engine map alongside
 * [CreditCardEngine] so the family map has two real adapters (skill's two-adapter rule for
 * a real seam, not a hypothetical one).
 *
 * Returns [ExtractionOutcome.UnsupportedLayout] until the bank-family reconciler and
 * fixtures land in a follow-up phase. The wire response then reads "Unsupported text
 * statement layout.", identical to the pre-refactor behaviour for [StatementFamily.Bank].
 */
class BankEngine : FamilyEngine {
  override val stageName: String = "bank-extract"

  override fun extract(text: String, issuer: IssuerProfile?): ExtractionOutcome =
    ExtractionOutcome.UnsupportedLayout
}
