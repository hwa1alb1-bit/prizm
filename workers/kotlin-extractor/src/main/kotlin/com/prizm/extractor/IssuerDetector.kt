package com.prizm.extractor

/**
 * An issuer's identity (what we tell the customer) plus the layout key that selects regex
 * variants for period and row extraction. Identity affects only metadata; layout affects only
 * how text is sliced. Neither changes the family-level reconciliation math.
 */
data class IssuerProfile(val name: String, val layoutKey: String)

object IssuerDetector {
  private val PROFILES: List<Pair<IssuerProfile, Regex>> = listOf(
    IssuerProfile(name = "Chase", layoutKey = LayoutKey.CHASE) to Regex("chase\\.com", RegexOption.IGNORE_CASE),
    IssuerProfile(name = "Bank of America", layoutKey = LayoutKey.BANK_OF_AMERICA) to Regex("Bank of America", RegexOption.IGNORE_CASE),
  )

  fun detect(text: String): IssuerProfile? =
    PROFILES.firstOrNull { (_, pattern) -> pattern.containsMatchIn(text) }?.first
}

object LayoutKey {
  const val CHASE = "chase"
  const val BANK_OF_AMERICA = "bank_of_america"
}
