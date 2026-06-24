package com.prizm.extractor

/**
 * Bank-family layout. Describes how a single issuer renders period dates, account anchors,
 * balance labels, transaction-section markers, and row patterns. Identity affects only metadata;
 * layout affects only how text is sliced. Reconciliation math is hard-coded in [BankReconciler]
 * and is not parameterized by layout.
 */
data class BankLayout(
  /** Regex variants for "April 18, 2026 to May 15, 2026" style period strings. */
  val periodPatterns: List<PeriodPattern>,
  /** Section markers under which transaction rows are listed, in order. */
  val sections: List<BankSection>,
  /** Regex that anchors the start of a per-account block. */
  val accountAnchor: Regex,
  /** Beginning-balance label. */
  val beginningBalanceLabel: Regex,
  /** Ending-balance label. */
  val endingBalanceLabel: Regex,
  /** Pattern that matches MM/DD/YY at the start of a row. */
  val rowDatePattern: Regex,
  /** Pattern that matches a money value (with optional leading sign, thousands separators). */
  val amountPattern: Regex,
)

/**
 * One transaction section inside a per-account block (e.g. "Deposits and other additions" or
 * "Other subtractions"). [signMultiplier] applies to printed amounts regardless of their
 * printed sign — deposits are always +, debit-side sections are always −.
 */
data class BankSection(
  val startMarker: Regex,
  val endMarker: Regex,
  val label: String,
  val signMultiplier: Int,
)

object BankLayouts {
  fun forIssuer(layoutKey: String?): BankLayout =
    when (layoutKey) {
      LayoutKey.BANK_OF_AMERICA -> BANK_OF_AMERICA
      LayoutKey.GENERIC -> GENERIC
      else -> GENERIC
    }

  /**
   * Best-effort layout for bank statements from issuers we haven't profiled. Section markers,
   * balance labels, account anchors, and date patterns use synonym-broad regexes that cover
   * Wells Fargo, USAA, Capital One, Citi, US Bank, PNC, and the long tail of community
   * banks. When this layout is selected, the engine raises `unknown_issuer` in `reviewFlags`
   * so reviewers verify rows before exporting.
   */
  private val GENERIC = BankLayout(
    periodPatterns = listOf(
      // "April 18, 2026 to May 15, 2026" / "through May 15, 2026"
      PeriodPattern(
        regex = Regex("""([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+(?:to|through|-)\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})"""),
        parse = ::parseMonthNameRange,
      ),
      // "04/18/2026 to 05/15/2026" / "04/18/2026 - 05/15/2026"
      PeriodPattern(
        regex = Regex("""(\d{1,2})/(\d{1,2})/(\d{4})\s+(?:to|through|-)\s+(\d{1,2})/(\d{1,2})/(\d{4})"""),
        parse = ::parseSlashFullYearDateRange,
      ),
    ),
    sections = listOf(
      // Deposit-side section names across issuers. Order: most specific first to avoid early
      // matches stealing rows from a more specific section.
      BankSection(
        startMarker = Regex(
          """^(?:Deposits and other additions|Deposits and Credits|Deposits and Additions|Deposits|Credits|Electronic Deposits)(?: - continued)?$""",
          RegexOption.IGNORE_CASE,
        ),
        endMarker = Regex(
          """^(?:Total deposits|Total credits)""",
          RegexOption.IGNORE_CASE,
        ),
        label = "Deposits",
        signMultiplier = 1,
      ),
      // Withdrawal-side: subtractions / debits / withdrawals.
      BankSection(
        startMarker = Regex(
          """^(?:Other subtractions|Withdrawals and Other Subtractions|Withdrawals and Other Deductions|Other Deductions|Electronic Withdrawals|Withdrawals|Debits)(?: - continued)?$""",
          RegexOption.IGNORE_CASE,
        ),
        endMarker = Regex(
          """^(?:Total (?:other subtractions|withdrawals|deductions|debits))""",
          RegexOption.IGNORE_CASE,
        ),
        label = "Withdrawals",
        signMultiplier = -1,
      ),
      // Card-debits and ATM-debits when issuer breaks them out separately.
      BankSection(
        startMarker = Regex(
          """^(?:ATM and debit card subtractions|ATM Withdrawals|Card Withdrawals|Debit Card Purchases)$""",
          RegexOption.IGNORE_CASE,
        ),
        endMarker = Regex(
          """^Total (?:ATM|card|debit)""",
          RegexOption.IGNORE_CASE,
        ),
        label = "Card and ATM",
        signMultiplier = -1,
      ),
      // Checks paid.
      BankSection(
        startMarker = Regex("""^Checks(?: Paid| Cleared)?$""", RegexOption.IGNORE_CASE),
        endMarker = Regex("""^Total checks""", RegexOption.IGNORE_CASE),
        label = "Checks",
        signMultiplier = -1,
      ),
      // Service fees.
      BankSection(
        startMarker = Regex("""^(?:Service fees|Fees Charged|Bank Fees)$""", RegexOption.IGNORE_CASE),
        endMarker = Regex("""^Total (?:service )?fees""", RegexOption.IGNORE_CASE),
        label = "Service fees",
        signMultiplier = -1,
      ),
    ),
    accountAnchor = Regex(
      """(?:Account(?:\s*(?:#|number|no\.?))?|Acct(?:\s*(?:#|no\.?))?)\s*:?\s*([X\d][X\d\s\-]{6,})""",
      RegexOption.IGNORE_CASE,
    ),
    beginningBalanceLabel = Regex(
      """(?:Beginning|Opening|Starting|Previous|Prior)\s+balance(?:\s+on\s+.+?)?\s+\$?(-?[\d,]+\.\d{2})""",
      RegexOption.IGNORE_CASE,
    ),
    endingBalanceLabel = Regex(
      """(?:Ending|Closing|Final|New)\s+balance(?:\s+on\s+.+?)?\s+\$?(-?[\d,]+\.\d{2})""",
      RegexOption.IGNORE_CASE,
    ),
    // Accept both MM/DD/YY and MM/DD/YYYY at the start of a row.
    rowDatePattern = Regex("""^(\d{1,2}/\d{1,2}/(?:\d{2}|\d{4}))\s+(.*)$"""),
    amountPattern = Regex("""^-?\$?[\d,]+\.\d{2}$"""),
  )

  private val BANK_OF_AMERICA = BankLayout(
    periodPatterns = listOf(
      // "April 18, 2026 to May 15, 2026"
      PeriodPattern(
        regex = Regex("""([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+to\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})"""),
        parse = ::parseMonthNameRange,
      ),
      // "for April 18, 2026 to May 15, 2026" (cover page variant — anchor is on previous line, regex above matches)
    ),
    sections = listOf(
      BankSection(
        startMarker = Regex("""^Deposits and other additions(?: - continued)?$""", RegexOption.IGNORE_CASE),
        endMarker = Regex("""^Total deposits and other additions""", RegexOption.IGNORE_CASE),
        label = "Deposits and other additions",
        signMultiplier = 1,
      ),
      BankSection(
        startMarker = Regex("""^Other subtractions$""", RegexOption.IGNORE_CASE),
        endMarker = Regex("""^Total other subtractions""", RegexOption.IGNORE_CASE),
        label = "Other subtractions",
        signMultiplier = -1,
      ),
      BankSection(
        startMarker = Regex("""^ATM and debit card subtractions$""", RegexOption.IGNORE_CASE),
        endMarker = Regex("""^Total ATM and debit card subtractions""", RegexOption.IGNORE_CASE),
        label = "ATM and debit card subtractions",
        signMultiplier = -1,
      ),
      BankSection(
        startMarker = Regex("""^Checks$""", RegexOption.IGNORE_CASE),
        endMarker = Regex("""^Total checks""", RegexOption.IGNORE_CASE),
        label = "Checks",
        signMultiplier = -1,
      ),
      BankSection(
        startMarker = Regex("""^Service fees$""", RegexOption.IGNORE_CASE),
        endMarker = Regex("""^Total service fees""", RegexOption.IGNORE_CASE),
        label = "Service fees",
        signMultiplier = -1,
      ),
    ),
    accountAnchor = Regex("""Account number:\s*([\d\s]+)""", RegexOption.IGNORE_CASE),
    beginningBalanceLabel = Regex("""Beginning balance on .+?\s+\$?(-?[\d,]+\.\d{2})""", RegexOption.IGNORE_CASE),
    endingBalanceLabel = Regex("""Ending balance on .+?\s+\$?(-?[\d,]+\.\d{2})""", RegexOption.IGNORE_CASE),
    rowDatePattern = Regex("""^(\d{2}/\d{2}/\d{2})\s+(.*)$"""),
    amountPattern = Regex("""^-?[\d,]+\.\d{2}$"""),
  )
}

internal object BankPeriodExtractor {
  fun extract(text: String, layout: BankLayout): StatementPeriod? {
    for (pattern in layout.periodPatterns) {
      val match = pattern.regex.find(text) ?: continue
      return pattern.parse(match)
    }
    return null
  }
}
