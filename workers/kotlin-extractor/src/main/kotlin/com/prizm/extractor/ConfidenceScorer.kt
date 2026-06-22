package com.prizm.extractor

private const val MISMATCHED_TRANSACTION_CONFIDENCE = 0.89

object ConfidenceScorer {
  fun score(
    requiredFields: List<Any?>,
    transactions: List<ParsedTransaction>,
    reconciles: Boolean,
  ): Confidence {
    val fields = fieldConfidence(requiredFields)
    val transactionConfidence = transactionConfidence(transactions, reconciles)
    val reconciliationConfidence = if (reconciles) 1.0 else 0.0
    return Confidence(
      overall = money((fields + transactionConfidence + reconciliationConfidence) / 3),
      fields = fields,
      transactions = transactionConfidence,
    )
  }

  fun transactionConfidence(transactions: List<ParsedTransaction>, reconciles: Boolean): Double =
    when {
      transactions.isEmpty() -> 0.0
      reconciles -> 1.0
      else -> MISMATCHED_TRANSACTION_CONFIDENCE
    }

  private fun fieldConfidence(requiredFields: List<Any?>): Double {
    if (requiredFields.isEmpty()) return 0.0
    return money(requiredFields.count { it != null }.toDouble() / requiredFields.size)
  }
}
