// Client + server safe. The full export pipeline that consumes this lives in
// lib/server/statement-export.ts. The constants and helpers here let both surfaces
// agree on how a chosen sign convention is applied to a single transaction so the
// UI can preview the effective sign without round-tripping through the export endpoint.

export const SIGN_CONVENTIONS = ['auto', 'bank', 'credit_card'] as const

export type SignConvention = (typeof SIGN_CONVENTIONS)[number]

export type PreviewTransaction = {
  debit?: number | string | null
  credit?: number | string | null
  amount?: number | string | null
}

/**
 * Resolve the effective convention from an explicit override + the statement's stored type.
 * Mirrors resolveIsCreditCard() in lib/server/statement-export.ts.
 */
export function resolveSignConvention(
  statementType: string | null | undefined,
  override: SignConvention | undefined,
): 'bank' | 'credit_card' {
  if (override === 'bank') return 'bank'
  if (override === 'credit_card') return 'credit_card'
  return statementType === 'credit_card' ? 'credit_card' : 'bank'
}

/**
 * Compute the signed numeric amount that would appear in a CSV-shaped export's Amount column
 * after the given convention is applied. Returns null when neither a numeric amount nor a
 * numeric debit/credit is available.
 */
export function previewSignedAmount(
  row: PreviewTransaction,
  convention: 'bank' | 'credit_card',
): number | null {
  const debit = numeric(row.debit)
  const credit = numeric(row.credit)
  const amount = numeric(row.amount)

  if (convention === 'credit_card') {
    if (credit !== null) return Math.abs(credit)
    if (debit !== null) return -Math.abs(debit)
    return amount
  }
  // Bank convention.
  if (amount !== null) return amount
  if (credit !== null) return Math.abs(credit)
  if (debit !== null) return -Math.abs(debit)
  return null
}

function numeric(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const trimmed = value.trim().replaceAll(',', '')
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}
