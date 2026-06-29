package com.prizm.extractor

/**
 * Bank-family engine. Detects combined statements (multiple accounts in one PDF), parses each
 * per-account block separately via [BankAccountSplitter], and returns the primary (first)
 * account as the [ParsedStatement] surfaced to the review UI. Additional accounts are summarized
 * in [ParsedStatement.metadata]'s `additionalAccounts` key and a `additional_accounts_detected`
 * review flag is raised so the UI can surface a soft notice.
 *
 * Supports Bank of America Adv Plus Banking + Regular Savings (the canonical combined statement
 * shape). Other BOA variants and other issuers fall back to [ExtractionOutcome.UnsupportedLayout]
 * by virtue of the layout regexes not matching their balance/section markers.
 */
class BankEngine : FamilyEngine {
  override val stageName: String = "bank-extract"

  override fun extract(text: String, issuer: IssuerProfile?): ExtractionOutcome {
    val layout = BankLayouts.forIssuer(issuer?.layoutKey)
    // Period is statement-wide; extract once from the full text. Falls back to per-account
    // Beginning/Ending labels if the explicit "X to Y" range is missing from the header.
    val period = BankPeriodExtractor.extract(text, layout) ?: return ExtractionOutcome.UnsupportedLayout
    val sections = BankAccountSplitter.split(text, layout)
    if (sections.isEmpty()) return ExtractionOutcome.UnsupportedLayout

    val parsedAccounts = sections.mapNotNull { section ->
      try {
        parseAccount(section, period, layout, issuer)
      } catch (_: MissingFieldException) {
        null
      }
    }
    if (parsedAccounts.isEmpty()) return ExtractionOutcome.UnsupportedLayout

    val primary = parsedAccounts.first()
    val additional = parsedAccounts.drop(1)

    val statement = if (additional.isEmpty()) {
      primary.statement
    } else {
      val additionalSummary = additional.map { account ->
        mapOf(
          "accountLast4" to account.statement.accountLast4,
          "statementType" to account.statement.statementType,
          "transactionCount" to account.statement.transactions.size,
          "openingBalance" to account.statement.openingBalance,
          "closingBalance" to account.statement.closingBalance,
        )
      }
      primary.statement.copy(
        metadata = primary.statement.metadata + ("additionalAccounts" to additionalSummary),
        reviewFlags = primary.statement.reviewFlags + "additional_accounts_detected",
      )
    }
    return ExtractionOutcome.Success(statement)
  }

  private data class ParsedAccount(val statement: ParsedStatement)

  private fun parseAccount(
    section: BankAccountSection,
    period: StatementPeriod,
    layout: BankLayout,
    issuer: IssuerProfile?,
  ): ParsedAccount {
    val totals = BankLabels.readTotals(section.text, layout)
    val rows = BankRowExtractor.extract(section.text, period, layout)
    val transactions = rows.map(::toParsedTransaction)
    val reconciliation = BankReconciler.reconcile(totals, rows)

    val confidence = ConfidenceScorer.score(
      requiredFields = listOf(
        section.accountLast4.ifEmpty { null },
        period.start,
        period.end,
        totals.beginningBalance,
        totals.endingBalance,
        reconciliation.reportedTotal,
      ),
      transactions = transactions,
      reconciles = reconciliation.reconciles,
    )
    val scoredTransactions = transactions.map { it.copy(confidence = confidence.transactions) }

    val statement = ParsedStatement(
      statementType = "bank",
      bankName = issuer?.name,
      accountLast4 = section.accountLast4.ifEmpty { null },
      periodStart = period.start.toString(),
      periodEnd = period.end.toString(),
      openingBalance = totals.beginningBalance,
      closingBalance = totals.endingBalance,
      reportedTotal = reconciliation.reportedTotal,
      computedTotal = reconciliation.computedTotal,
      reconciles = reconciliation.reconciles,
      ready = transactions.isNotEmpty() && reconciliation.reconciles,
      confidence = confidence,
      reviewFlags = reviewFlags(transactions, reconciliation.reconciles, issuer),
      metadata = metadata(issuer, totals),
      transactions = scoredTransactions,
      reconciliationReport = ReconciliationReportWire(
        totalDelta = reconciliation.report.totalDelta,
        direction = reconciliation.report.direction.name.lowercase(),
        summary = reconciliation.report.summary,
      ),
    )
    return ParsedAccount(statement)
  }

  private fun toParsedTransaction(row: ExtractedRow): ParsedTransaction {
    val isCredit = row.rawAmount >= 0
    val absolute = money(kotlin.math.abs(row.rawAmount))
    return ParsedTransaction(
      date = row.date.toString(),
      description = row.description,
      amount = row.rawAmount,
      debit = if (!isCredit) absolute else null,
      credit = if (isCredit) absolute else null,
      confidence = 0.0,
      statement_section = row.section,
      reference = row.reference,
    )
  }

  private fun reviewFlags(
    transactions: List<ParsedTransaction>,
    reconciles: Boolean,
    issuer: IssuerProfile?,
  ): List<String> {
    val flags = mutableListOf<String>()
    if (transactions.isEmpty()) flags += "transactions_missing"
    if (!reconciles) flags += "reconciliation_mismatch"
    if (issuer?.layoutKey == LayoutKey.GENERIC) flags += "unknown_issuer"
    return flags
  }

  private fun metadata(issuer: IssuerProfile?, totals: BankTotals): Map<String, Any?> =
    mapOf(
      "issuer" to issuer?.name,
      "beginningBalance" to totals.beginningBalance,
      "endingBalance" to totals.endingBalance,
      "genericLayoutUsed" to (issuer?.layoutKey == LayoutKey.GENERIC),
    ).filterValues { it != null }
}
