package com.prizm.extractor

/**
 * Coarse statement family. Reconciliation math is hard-coded per family and cannot be overridden
 * by issuer-specific layouts. A new family means new math, not a tweak.
 */
enum class StatementFamily {
  CreditCard,
  Bank,
  Unknown,
}

/**
 * Deterministic family detection from label presence. Tied to reconciliation contracts in
 * [CreditCardReconciler] / future [BankReconciler]: if labels for a family are missing, that
 * family's math cannot apply, so a mismatch fails closed as [StatementFamily.Unknown].
 */
object StatementFamilyDetector {
  fun detect(text: String): StatementFamily {
    val collapsed = collapse(text)
    val creditCard = isCreditCardFamily(collapsed)
    val bank = isBankFamily(collapsed)
    return when {
      creditCard -> StatementFamily.CreditCard
      bank -> StatementFamily.Bank
      else -> StatementFamily.Unknown
    }
  }

  private fun isCreditCardFamily(text: String): Boolean {
    val core = text.contains("Previous Balance", ignoreCase = true) &&
      text.contains("New Balance", ignoreCase = true)
    val anchor = text.contains("Minimum Payment Due", ignoreCase = true) ||
      text.contains("Payment Due Date", ignoreCase = true)
    return core && anchor
  }

  private fun isBankFamily(text: String): Boolean {
    val core = text.contains("Beginning Balance", ignoreCase = true) &&
      text.contains("Ending Balance", ignoreCase = true)
    val anchor = text.contains("Deposits", ignoreCase = true) ||
      text.contains("Withdrawals", ignoreCase = true)
    return core && anchor
  }
}
