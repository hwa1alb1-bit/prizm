package com.prizm.extractor

/**
 * Orchestrates extraction within the credit-card family. Picks an issuer layout (regex variants
 * for period and rows), resolves family labels to totals, extracts rows generically, then hands
 * everything to [CreditCardReconciler] for the hard math.
 */
class CreditCardEngine {
  fun extract(text: String, issuer: IssuerProfile?): ExtractionOutcome {
    val collapsed = collapse(text)
    val layout = CreditCardLayouts.forIssuer(issuer?.layoutKey)

    val period = PeriodExtractor.extract(collapsed, layout)
      ?: return ExtractionOutcome.MissingField(StatementFamily.CreditCard, "period")

    val totals = try {
      readTotals(collapsed)
    } catch (error: MissingFieldException) {
      return ExtractionOutcome.MissingField(StatementFamily.CreditCard, error.field)
    }

    val rows = TransactionRowExtractor.extract(text, collapsed, period, layout)
    val transactions = rows.map(::toParsedTransaction)
    val reconciliation = CreditCardReconciler.reconcile(totals, transactions)
    val accountLast4 = CreditCardLabels.last4(collapsed)
    val confidence = ConfidenceScorer.score(
      requiredFields = listOf(
        accountLast4,
        period.start,
        period.end,
        totals.previousBalance,
        totals.newBalance,
        reconciliation.reportedTotal,
      ),
      transactions = transactions,
      reconciles = reconciliation.reconciles,
    )
    val scoredTransactions = transactions.map { it.copy(confidence = confidence.transactions) }

    val statement = ParsedStatement(
      statementType = "credit_card",
      bankName = issuer?.name,
      accountLast4 = accountLast4,
      periodStart = period.start.toString(),
      periodEnd = period.end.toString(),
      openingBalance = totals.previousBalance,
      closingBalance = totals.newBalance,
      reportedTotal = reconciliation.reportedTotal,
      computedTotal = reconciliation.computedTotal,
      reconciles = reconciliation.reconciles,
      ready = transactions.isNotEmpty() && reconciliation.reconciles,
      confidence = confidence,
      reviewFlags = reviewFlags(transactions, reconciliation.reconciles),
      metadata = metadata(issuer, collapsed, totals),
      transactions = scoredTransactions,
    )

    return ExtractionOutcome.Success(statement)
  }

  private fun readTotals(collapsed: String): CreditCardTotals = CreditCardTotals(
    previousBalance = CreditCardLabels.requireMoney(collapsed, CreditCardLabels.PREVIOUS_BALANCE, "previousBalance"),
    newBalance = CreditCardLabels.requireMoney(collapsed, CreditCardLabels.NEW_BALANCE, "newBalance"),
    payments = CreditCardLabels.requireMoney(collapsed, CreditCardLabels.PAYMENTS, "payments"),
    purchases = CreditCardLabels.requireMoney(collapsed, CreditCardLabels.PURCHASES, "purchases"),
    fees = CreditCardLabels.requireMoney(collapsed, CreditCardLabels.FEES, "fees"),
    interest = CreditCardLabels.requireMoney(collapsed, CreditCardLabels.INTEREST, "interest"),
  )

  private fun toParsedTransaction(row: ExtractedRow): ParsedTransaction {
    val isCredit = row.rawAmount < 0 || row.section.contains("payment", ignoreCase = true)
    val normalized = money(kotlin.math.abs(row.rawAmount))
    return ParsedTransaction(
      date = row.date.toString(),
      description = row.description,
      amount = if (isCredit) normalized else -normalized,
      debit = if (isCredit) null else normalized,
      credit = if (isCredit) normalized else null,
      confidence = 0.0,
      statement_section = row.section,
      reference = row.reference,
    )
  }

  private fun reviewFlags(transactions: List<ParsedTransaction>, reconciles: Boolean): List<String> {
    val flags = mutableListOf<String>()
    if (transactions.isEmpty()) flags += "transactions_missing"
    if (!reconciles) flags += "reconciliation_mismatch"
    return flags
  }

  private fun metadata(issuer: IssuerProfile?, collapsed: String, totals: CreditCardTotals): Map<String, Any?> =
    mapOf(
      "issuer" to issuer?.name,
      "paymentDueDate" to CreditCardLabels.paymentDueDate(collapsed),
      "minimumPaymentDue" to CreditCardLabels.optionalMoney(collapsed, CreditCardLabels.MINIMUM_PAYMENT_DUE),
      "previousBalance" to totals.previousBalance,
      "newBalance" to totals.newBalance,
      "purchaseTotal" to totals.purchases,
      "paymentTotal" to money(kotlin.math.abs(totals.payments)),
      "feeTotal" to totals.fees,
      "interestTotal" to totals.interest,
    ).filterValues { it != null }
}
