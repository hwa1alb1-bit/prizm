export type TextractBlock = {
  BlockType?: string
  Text?: string
  Confidence?: number
  Page?: number
}

export type TextractOutput = {
  JobStatus?: string
  Blocks?: TextractBlock[]
}

export type ParsedStatementTransaction = {
  date: string
  description: string
  amount: number
  confidence: number
  debit?: number
  credit?: number
  balance?: number
  source?: string
  transaction_date?: string
  merchant?: string
  category?: string
  statement_section?: string
  reference?: string
  needs_review?: boolean
  review_reason?: string
}

export type ParsedStatement = {
  statementType: 'bank' | 'credit_card'
  bankName: string | null
  accountLast4: string | null
  periodStart: string | null
  periodEnd: string | null
  openingBalance: number | null
  closingBalance: number | null
  reportedTotal: number | null
  computedTotal: number
  reconciles: boolean
  ready: boolean
  confidence: {
    overall: number
    fields: number
    transactions: number
  }
  reviewFlags: string[]
  metadata: Record<string, string | number | boolean | null>
  billablePageCount: number
  transactions: ParsedStatementTransaction[]
}

export type ParsedTextractStatementResult = {
  documentState: 'ready' | 'failed'
  statements: ParsedStatement[]
}

type Line = {
  text: string
  confidence: number
  page: number
}

const TRANSACTION_LINE_PATTERN =
  /^(\d{4}-\d{2}-\d{2})\s*\|\s*(.+?)\s*\|\s*(-?\$?[\d,]+(?:\.\d{2})?)$/
const CREDIT_CARD_TRANSACTION_LINE_PATTERN =
  /^(\d{4}-\d{2}-\d{2})\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(-?\$?[\d,]+(?:\.\d{2})?)$/

export function parseTextractStatement(output: TextractOutput): ParsedTextractStatementResult {
  const lines = extractLines(output)
  const statementType = detectStatementType(lines)
  const billablePages = new Set<number>()
  const transactions: ParsedStatementTransaction[] = []
  for (const line of lines) {
    const transaction =
      statementType === 'credit_card'
        ? parseCreditCardTransactionLine(line)
        : parseTransactionLine(line)
    if (transaction) {
      transactions.push(transaction)
      billablePages.add(line.page)
    }
  }
  const billablePageCount = billablePages.size
  const bankName =
    firstCapture(lines, /^bank:\s*(.+)$/i) ??
    firstCapture(lines, /^issuer:\s*(.+)$/i) ??
    detectKnownIssuer(lines)
  const accountLast4 =
    firstCapture(lines, /^account ending:\s*(\d{4})$/i) ??
    firstCapture(lines, /^card ending:\s*(\d{4})$/i) ??
    firstCapture(lines, /account (?:number )?ending in\s*\*?(\d{4})/i) ??
    firstCapture(lines, /account #+\s*(\d{4})/i)
  const period =
    firstMatch(
      lines,
      /^statement period:?\s*(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})$/i,
    ) ?? slashDatePeriod(lines)
  const metadata = statementType === 'credit_card' ? creditCardMetadata(lines) : {}
  const openingBalance =
    statementType === 'credit_card'
      ? moneyMetadata(metadata, 'previousBalance')
      : moneyField(lines, /^opening balance:\s*(.+)$/i)
  const closingBalance =
    statementType === 'credit_card'
      ? moneyMetadata(metadata, 'newBalance')
      : moneyField(lines, /^closing balance:\s*(.+)$/i)
  const reportedTotal =
    statementType === 'credit_card'
      ? moneyField(lines, /^new activity total:\s*(.+)$/i)
      : moneyField(lines, /^reported transaction total:\s*(.+)$/i)
  const computedTotal = roundMoney(
    statementType === 'credit_card'
      ? computeCreditCardActivity(transactions)
      : transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
  )
  const reconciles = reportedTotal !== null && computedTotal === reportedTotal
  const fieldConfidence = averageConfidence(
    lines.filter(
      (line) => !isTransactionLine(line.text) && line.text.toLowerCase() !== 'transactions',
    ),
  )
  const transactionConfidence = averageConfidence(
    lines.filter((line) => isTransactionLine(line.text)),
  )
  const confidence = {
    fields: roundConfidence(fieldConfidence),
    transactions: roundConfidence(transactionConfidence),
    overall: roundConfidence(averageConfidence(lines)),
  }
  const reviewFlags = reviewFlagsFor({ confidence, reconciles, transactions })
  const ready = transactions.length > 0 && reconciles

  return {
    documentState: ready ? 'ready' : 'failed',
    statements: [
      {
        statementType,
        bankName,
        accountLast4,
        periodStart: period?.[1] ?? null,
        periodEnd: period?.[2] ?? null,
        openingBalance,
        closingBalance,
        reportedTotal,
        computedTotal,
        reconciles,
        ready,
        confidence,
        reviewFlags,
        metadata,
        billablePageCount,
        transactions,
      },
    ],
  }
}

function extractLines(output: TextractOutput): Line[] {
  return (output.Blocks ?? [])
    .filter((block) => block.BlockType === 'LINE' && typeof block.Text === 'string')
    .map((block) => ({
      text: block.Text!.trim(),
      confidence: normalizeConfidence(block.Confidence),
      page: typeof block.Page === 'number' && block.Page > 0 ? block.Page : 1,
    }))
    .filter((line) => line.text.length > 0)
}

function parseTransactionLine(line: Line): ParsedStatementTransaction | null {
  const match = line.text.match(TRANSACTION_LINE_PATTERN)
  if (!match) return null

  return {
    date: match[1],
    description: match[2].trim(),
    amount: parseMoney(match[3]),
    confidence: roundConfidence(line.confidence),
  }
}

function parseCreditCardTransactionLine(line: Line): ParsedStatementTransaction | null {
  const match = line.text.match(CREDIT_CARD_TRANSACTION_LINE_PATTERN)
  if (!match) return null

  const amount = parseMoney(match[4])
  const section = match[3].trim()
  const isCredit = isCreditCardCredit(section, match[2])
  const signedAmount = isCredit ? Math.abs(amount) : -Math.abs(amount)
  const transaction: ParsedStatementTransaction = {
    date: match[1],
    transaction_date: match[1],
    description: match[2].trim(),
    merchant: match[2].trim(),
    amount: roundMoney(signedAmount),
    confidence: roundConfidence(line.confidence),
    statement_section: section,
  }

  if (isCredit) {
    transaction.credit = roundMoney(Math.abs(amount))
  } else {
    transaction.debit = roundMoney(Math.abs(amount))
  }

  return transaction
}

function detectStatementType(lines: Line[]): ParsedStatement['statementType'] {
  const labeled = lines.some((line) =>
    /^(issuer|card ending|payment due date|minimum payment due|credit limit|available credit):/i.test(
      line.text,
    ),
  )
  if (labeled) return 'credit_card'
  const contextual = lines.some((line) =>
    /(previous balance|new balance|payments and other credits|purchases and other debits|minimum payment due|cardmember service|card ending)/i.test(
      line.text,
    ),
  )
  return contextual ? 'credit_card' : 'bank'
}

const KNOWN_ISSUERS = [
  'JPMorgan Chase',
  'Chase',
  'Bank of America',
  'Wells Fargo',
  'Citibank',
  'Citi',
  'Capital One',
  'American Express',
  'Discover',
  'U.S. Bank',
  'US Bank',
  'PNC Bank',
  'PNC',
  'TD Bank',
  'HSBC',
  'Truist',
  'USAA',
  'Charles Schwab',
  'Fidelity',
  'Ally Bank',
  'Ally',
  'Barclays',
]

function detectKnownIssuer(lines: Line[]): string | null {
  for (const line of lines) {
    for (const issuer of KNOWN_ISSUERS) {
      const pattern = new RegExp(`\\b${escapeRegex(issuer)}\\b`, 'i')
      if (pattern.test(line.text)) return canonicalIssuer(issuer)
    }
  }
  return null
}

function canonicalIssuer(matched: string): string {
  const lower = matched.toLowerCase()
  if (lower.includes('chase')) return 'Chase'
  if (lower === 'citi' || lower === 'citibank') return 'Citi'
  if (lower === 'pnc' || lower === 'pnc bank') return 'PNC Bank'
  if (lower === 'ally' || lower === 'ally bank') return 'Ally Bank'
  return matched
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function slashDatePeriod(lines: Line[]): RegExpMatchArray | null {
  const match = firstMatch(
    lines,
    /statement period\s+(\d{2})\/(\d{2})\/(\d{2,4})\s*[-–to]+\s*(\d{2})\/(\d{2})\/(\d{2,4})/i,
  )
  if (!match) return null
  const [, m1, d1, y1, m2, d2, y2] = match
  const start = `${normalizeYear(y1)}-${m1}-${d1}`
  const end = `${normalizeYear(y2)}-${m2}-${d2}`
  return [match[0], start, end] as unknown as RegExpMatchArray
}

function normalizeYear(year: string): string {
  if (year.length === 4) return year
  const numeric = Number(year)
  return numeric >= 70 ? `19${year}` : `20${year.padStart(2, '0')}`
}

function creditCardMetadata(lines: Line[]): ParsedStatement['metadata'] {
  const metadata: ParsedStatement['metadata'] = {}
  addDateMetadata(metadata, 'paymentDueDate', lines, /^payment due date:\s*(\d{4}-\d{2}-\d{2})$/i)
  addMoneyMetadata(metadata, 'minimumPaymentDue', lines, /^minimum payment due:?\s+(.+)$/i)
  addMoneyMetadata(metadata, 'previousBalance', lines, /^previous balance:?\s+(.+)$/i)
  addMoneyMetadata(metadata, 'newBalance', lines, /^new balance:?\s+(.+)$/i)
  addMoneyMetadata(metadata, 'creditLimit', lines, /^credit limit:?\s+(.+)$/i)
  addMoneyMetadata(metadata, 'availableCredit', lines, /^available credit:?\s+(.+)$/i)
  addMoneyMetadata(metadata, 'purchaseTotal', lines, /^purchases:?\s+(.+)$/i)
  addMoneyMetadata(
    metadata,
    'paymentTotal',
    lines,
    /^payments(?: and other)?(?: and)? credits:?\s+(.+)$/i,
  )
  addMoneyMetadata(metadata, 'feeTotal', lines, /^fees charged:?\s+(.+)$/i)
  addMoneyMetadata(metadata, 'interestTotal', lines, /^interest charged:?\s+(.+)$/i)
  addMoneyMetadata(metadata, 'rewardsEarned', lines, /^rewards earned:?\s+(.+)$/i)
  return metadata
}

function addDateMetadata(
  metadata: ParsedStatement['metadata'],
  key: string,
  lines: Line[],
  pattern: RegExp,
): void {
  const value = firstCapture(lines, pattern)
  if (value) metadata[key] = value
}

function addMoneyMetadata(
  metadata: ParsedStatement['metadata'],
  key: string,
  lines: Line[],
  pattern: RegExp,
): void {
  const value = moneyField(lines, pattern)
  if (value !== null) metadata[key] = value
}

function moneyMetadata(metadata: ParsedStatement['metadata'], key: string): number | null {
  const value = metadata[key]
  return typeof value === 'number' ? value : null
}

function computeCreditCardActivity(transactions: ParsedStatementTransaction[]): number {
  return transactions.reduce((sum, transaction) => {
    if (typeof transaction.debit === 'number') return sum + transaction.debit
    if (typeof transaction.credit === 'number') return sum - transaction.credit
    return sum
  }, 0)
}

function isCreditCardCredit(section: string, description: string): boolean {
  if (/(purchase|fee|interest|cash advance)/i.test(section)) return false
  return /(payment|refund|statement credit|rewards? credit|payments and credits)/i.test(
    `${section} ${description}`,
  )
}

function isTransactionLine(text: string): boolean {
  return TRANSACTION_LINE_PATTERN.test(text) || CREDIT_CARD_TRANSACTION_LINE_PATTERN.test(text)
}

function firstMatch(lines: Line[], pattern: RegExp): RegExpMatchArray | null {
  for (const line of lines) {
    const match = line.text.match(pattern)
    if (match) return match
  }
  return null
}

function firstCapture(lines: Line[], pattern: RegExp): string | null {
  return firstMatch(lines, pattern)?.[1]?.trim() ?? null
}

function moneyField(lines: Line[], pattern: RegExp): number | null {
  const value = firstCapture(lines, pattern)
  return value ? parseMoney(value) : null
}

function parseMoney(value: string): number {
  const trimmed = value.trim()
  const sign = trimmed.includes('-') ? -1 : 1
  const numeric = Number(trimmed.replace(/[$,\s-]/g, ''))
  return roundMoney(sign * numeric)
}

function normalizeConfidence(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return value > 1 ? value / 100 : value
}

function averageConfidence(lines: Line[]): number {
  return average(lines.map((line) => line.confidence))
}

function average(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value))
  if (valid.length === 0) return 0
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function reviewFlagsFor(input: {
  confidence: ParsedStatement['confidence']
  reconciles: boolean
  transactions: ParsedStatementTransaction[]
}): string[] {
  const flags: string[] = []
  if (
    input.confidence.transactions < 0.9 ||
    input.transactions.some((transaction) => transaction.confidence < 0.85)
  ) {
    flags.push('low_confidence_transactions')
  }
  if (input.confidence.fields < 0.9) flags.push('low_confidence_fields')
  if (!input.reconciles) flags.push('reconciliation_mismatch')
  if (input.transactions.length === 0) flags.push('transactions_missing')
  return flags
}

function isPresent<T>(value: T | null): value is T {
  return value !== null
}
