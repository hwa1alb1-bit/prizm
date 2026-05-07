export type TextractBlock = {
  BlockType?: string
  Text?: string
  Confidence?: number
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
}

export type ParsedStatement = {
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
  transactions: ParsedStatementTransaction[]
}

export type ParsedTextractStatementResult = {
  documentState: 'ready' | 'failed'
  statements: ParsedStatement[]
}

type Line = {
  text: string
  confidence: number
}

const TRANSACTION_LINE_PATTERN =
  /^(\d{4}-\d{2}-\d{2})\s*\|\s*(.+?)\s*\|\s*(-?\$?[\d,]+(?:\.\d{2})?)$/

export function parseTextractStatement(output: TextractOutput): ParsedTextractStatementResult {
  const lines = extractLines(output)
  const transactions = lines.map(parseTransactionLine).filter(isPresent)
  const bankName = firstCapture(lines, /^bank:\s*(.+)$/i)
  const accountLast4 = firstCapture(lines, /^account ending:\s*(\d{4})$/i)
  const period = firstMatch(
    lines,
    /^statement period:\s*(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})$/i,
  )
  const openingBalance = moneyField(lines, /^opening balance:\s*(.+)$/i)
  const closingBalance = moneyField(lines, /^closing balance:\s*(.+)$/i)
  const reportedTotal = moneyField(lines, /^reported transaction total:\s*(.+)$/i)
  const computedTotal = roundMoney(
    transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
  )
  const reconciles = reportedTotal !== null && computedTotal === reportedTotal
  const fieldConfidence = averageConfidence(
    lines.filter(
      (line) => !TRANSACTION_LINE_PATTERN.test(line.text) && line.text !== 'Transactions',
    ),
  )
  const transactionConfidence = averageConfidence(
    lines.filter((line) => TRANSACTION_LINE_PATTERN.test(line.text)),
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
