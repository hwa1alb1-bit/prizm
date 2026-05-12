package com.prizm.extractor

data class WorkerPollResponse(
  val status: String,
  val jobId: String? = null,
  val statements: List<ParsedStatement> = emptyList(),
  val failureReason: String? = null,
)

data class ParsedStatement(
  val statementType: String,
  val bankName: String?,
  val accountLast4: String?,
  val periodStart: String?,
  val periodEnd: String?,
  val openingBalance: Double?,
  val closingBalance: Double?,
  val reportedTotal: Double?,
  val computedTotal: Double,
  val reconciles: Boolean,
  val ready: Boolean,
  val confidence: Confidence,
  val reviewFlags: List<String>,
  val metadata: Map<String, Any?>,
  val transactions: List<ParsedTransaction>,
)

data class Confidence(
  val overall: Double,
  val fields: Double,
  val transactions: Double,
)

data class ParsedTransaction(
  val date: String,
  val description: String,
  val amount: Double,
  val confidence: Double,
  val debit: Double? = null,
  val credit: Double? = null,
  val balance: Double? = null,
  val source: String? = "kotlin_worker",
  val transaction_date: String? = date,
  val merchant: String? = description,
  val category: String? = null,
  val statement_section: String? = null,
  val reference: String? = null,
  val needs_review: Boolean? = null,
  val review_reason: String? = null,
)
