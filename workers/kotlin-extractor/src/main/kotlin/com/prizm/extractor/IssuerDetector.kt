package com.prizm.extractor

/**
 * An issuer's identity (what we tell the customer) plus the layout key that selects regex
 * variants for period and row extraction. Identity affects only metadata; layout affects only
 * how text is sliced. Neither changes the family-level reconciliation math.
 */
data class IssuerProfile(val name: String, val layoutKey: String)

/**
 * One issuer's detection contract: a customer-facing profile plus the signals whose presence
 * proves the PDF came from that issuer. Any signal hit confirms the issuer; signals are kept
 * narrow (URLs, legal entity names, full bank names) to avoid false positives on partial
 * matches like "fargo" appearing in a payment description.
 */
internal data class IssuerFingerprint(
  val profile: IssuerProfile,
  val signals: List<Regex>,
)

/**
 * Detects the customer-facing financial institution from raw PDF text. Returns a non-null
 * [IssuerProfile] for every PDF: known fingerprints get their precision layout, recognized-but-
 * not-yet-profiled issuers get [LayoutKey.GENERIC] with their real name preserved, and totally
 * unknown PDFs get a generic "Unknown issuer" profile so the family engines always have a
 * layout to use.
 *
 * Two tiers, walked in order:
 *  1. **Precision layouts** — Chase + Bank of America. Profiled, regression-tested against
 *     real customer fixtures.
 *  2. **Name-only fingerprints** — 8 additional US banks (Wells Fargo, USAA, Capital One,
 *     Citi, US Bank, PNC, Discover, American Express). The detected name surfaces in
 *     `ParsedStatement.bankName` so customers see their issuer; extraction runs through the
 *     family's `GENERIC` layout. Engines raise the `unknown_issuer` review flag so reviewers
 *     verify rows before exporting.
 *
 * Adding an issuer: append to [FINGERPRINTS]. Adding a precision layout for an existing
 * fingerprint: swap that fingerprint's `layoutKey` from `GENERIC` to the new key, then add
 * the layout variant in the appropriate `*Layouts` module.
 */
object IssuerDetector {
  private val FINGERPRINTS: List<IssuerFingerprint> = listOf(
    // Precision layouts (profiled + tested against real fixtures).
    IssuerFingerprint(
      profile = IssuerProfile("Chase", LayoutKey.CHASE),
      signals = listOf(
        Regex("chase\\.com", RegexOption.IGNORE_CASE),
        Regex("JPMorgan Chase", RegexOption.IGNORE_CASE),
      ),
    ),
    IssuerFingerprint(
      profile = IssuerProfile("Bank of America", LayoutKey.BANK_OF_AMERICA),
      signals = listOf(
        Regex("bankofamerica\\.com", RegexOption.IGNORE_CASE),
        Regex("Bank of America", RegexOption.IGNORE_CASE),
      ),
    ),
    // Named-but-generic layouts. Issuer name surfaces in metadata; extraction runs through
    // the family's GENERIC layout. Engines raise `unknown_issuer` review flag.
    IssuerFingerprint(
      profile = IssuerProfile("Wells Fargo", LayoutKey.GENERIC),
      signals = listOf(
        Regex("wellsfargo\\.com", RegexOption.IGNORE_CASE),
        Regex("Wells Fargo Bank", RegexOption.IGNORE_CASE),
        Regex("\\bWELLS FARGO\\b"),
      ),
    ),
    IssuerFingerprint(
      profile = IssuerProfile("USAA", LayoutKey.GENERIC),
      signals = listOf(
        Regex("usaa\\.com", RegexOption.IGNORE_CASE),
        Regex("USAA Federal Savings", RegexOption.IGNORE_CASE),
        Regex("\\bUSAA\\b"),
      ),
    ),
    IssuerFingerprint(
      profile = IssuerProfile("Capital One", LayoutKey.GENERIC),
      signals = listOf(
        Regex("capitalone\\.com", RegexOption.IGNORE_CASE),
        Regex("Capital One,? N\\.A\\.", RegexOption.IGNORE_CASE),
        Regex("Capital One Bank", RegexOption.IGNORE_CASE),
      ),
    ),
    IssuerFingerprint(
      profile = IssuerProfile("Citi", LayoutKey.GENERIC),
      signals = listOf(
        Regex("citi\\.com", RegexOption.IGNORE_CASE),
        Regex("Citibank,? N\\.A\\.", RegexOption.IGNORE_CASE),
        Regex("Citigroup", RegexOption.IGNORE_CASE),
      ),
    ),
    IssuerFingerprint(
      profile = IssuerProfile("US Bank", LayoutKey.GENERIC),
      signals = listOf(
        Regex("usbank\\.com", RegexOption.IGNORE_CASE),
        Regex("U\\.S\\. Bank National Association", RegexOption.IGNORE_CASE),
        Regex("U\\.S\\. Bancorp", RegexOption.IGNORE_CASE),
      ),
    ),
    IssuerFingerprint(
      profile = IssuerProfile("PNC", LayoutKey.GENERIC),
      signals = listOf(
        Regex("pnc\\.com", RegexOption.IGNORE_CASE),
        Regex("PNC Bank,? N\\.A\\.", RegexOption.IGNORE_CASE),
      ),
    ),
    IssuerFingerprint(
      profile = IssuerProfile("Discover", LayoutKey.GENERIC),
      signals = listOf(
        Regex("discover\\.com", RegexOption.IGNORE_CASE),
        Regex("Discover Bank", RegexOption.IGNORE_CASE),
        Regex("DISCOVER CARD", RegexOption.IGNORE_CASE),
      ),
    ),
    IssuerFingerprint(
      profile = IssuerProfile("American Express", LayoutKey.GENERIC),
      signals = listOf(
        Regex("americanexpress\\.com", RegexOption.IGNORE_CASE),
        Regex("American Express", RegexOption.IGNORE_CASE),
        Regex("\\bAMEX\\b"),
      ),
    ),
  )

  private val UNKNOWN_ISSUER = IssuerProfile("Unknown issuer", LayoutKey.GENERIC)

  /**
   * Detects the issuer. Returns the matched fingerprint's profile, or [UNKNOWN_ISSUER] when
   * no fingerprint hits — never null. Callers can route every PDF through a family engine
   * because there's always a layout to apply.
   */
  fun detect(text: String): IssuerProfile =
    FINGERPRINTS.firstOrNull { fingerprint ->
      fingerprint.signals.any { signal -> signal.containsMatchIn(text) }
    }?.profile ?: UNKNOWN_ISSUER
}

object LayoutKey {
  const val CHASE = "chase"
  const val BANK_OF_AMERICA = "bank_of_america"
  const val GENERIC = "generic"
}
