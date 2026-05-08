'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StatementEvidenceView, StatementTransactionView } from '@/lib/server/document-history'

export type ReviewWorkflowException = {
  id: string
  title: string
  cause: string
}

type EditableReviewStatement = StatementEvidenceView & {
  revision?: number | null
}

type EditableReviewWorkflowProps = {
  documentId: string
  statement: EditableReviewStatement | null
  exceptions: ReviewWorkflowException[]
}

type MetadataDraft = {
  statementType: 'bank' | 'credit_card'
  bankName: string
  accountLast4: string
  periodStart: string
  periodEnd: string
  openingBalance: string
  closingBalance: string
  reportedTotal: string
  statementMetadata: Record<string, string | number | boolean | null>
}

type RowDraft = {
  id: string
  originalId: string | null
  postedAt: string
  description: string
  amount: string
  debit: string
  credit: string
  balance: string
  needsReview: boolean
  reviewReason: string | null
}

type SaveMode = 'draft' | 'review'

export function EditableReviewWorkflow({
  documentId,
  statement,
  exceptions,
}: EditableReviewWorkflowProps) {
  const router = useRouter()
  const [metadata, setMetadata] = useState<MetadataDraft>(() => metadataDraft(statement))
  const [rows, setRows] = useState<RowDraft[]>(() => rowDrafts(statement))
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [saveMode, setSaveMode] = useState<SaveMode | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  const activeRows = rows
  const invalidRows = useMemo(() => activeRows.filter(rowBlocksReview), [activeRows])
  const requiredGaps = requiredMetadataGaps(metadata, activeRows)
  const computedTotal = computeStatementTotal(activeRows, metadata.statementType)
  const reportedTotal = moneyOrNull(metadata.reportedTotal)
  const reconciles = reportedTotal !== null && computedTotal === reportedTotal
  const reviewBlocked =
    requiredGaps.length > 0 || invalidRows.length > 0 || exceptions.length > 0 || !reconciles

  if (!statement) {
    return (
      <p className="text-sm text-foreground/60">
        Editable review starts after OCR creates a statement record.
      </p>
    )
  }

  async function save(reviewed: boolean) {
    if (!statement) return
    setSaveError(null)
    setSaveStatus(null)
    setSaveMode(reviewed ? 'review' : 'draft')

    try {
      const response = await fetch(`/api/v1/documents/${documentId}/statement`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: statement.revision ?? 0,
          reviewed,
          statement: statementPayload(metadata),
          operations: operationsPayload(activeRows, deletedIds),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setSaveError(problemDetail(payload))
        return
      }

      setSaveStatus(reviewed ? 'Statement marked reviewed' : 'Draft saved')
      router.refresh()
    } catch {
      setSaveError('The statement edit could not be saved. Check your connection and try again.')
    } finally {
      setSaveMode(null)
    }
  }

  function updateMetadata<K extends keyof MetadataDraft>(key: K, value: MetadataDraft[K]) {
    setMetadata((current) => ({ ...current, [key]: value }))
  }

  function updateRow(id: string, patch: Partial<RowDraft>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function addRow() {
    const index = rows.length + deletedIds.length + 1
    setRows((current) => [
      ...current,
      {
        id: `new_row_${index}`,
        originalId: null,
        postedAt: '',
        description: '',
        amount: '',
        debit: '',
        credit: '',
        balance: '',
        needsReview: true,
        reviewReason: 'New row needs reviewer confirmation.',
      },
    ])
  }

  function deleteRow(row: RowDraft) {
    setRows((current) => current.filter((candidate) => candidate.id !== row.id))
    if (row.originalId) setDeletedIds((current) => [...current, row.originalId!])
  }

  return (
    <div className="space-y-5">
      {saveError && (
        <div
          role="alert"
          className="rounded-md border border-[color-mix(in_oklch,var(--danger)_35%,transparent)] bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-3 text-sm"
        >
          <p className="font-medium text-[var(--danger)]">Save failed</p>
          <p className="mt-1 text-foreground/75">{saveError}</p>
        </div>
      )}

      {saveStatus && (
        <p
          role="status"
          className="rounded-md border border-[color-mix(in_oklch,var(--success)_35%,transparent)] bg-[color-mix(in_oklch,var(--success)_8%,transparent)] p-3 text-sm font-medium text-[var(--success)]"
        >
          {saveStatus}
        </p>
      )}

      {reviewBlocked && (
        <div
          role="status"
          className="rounded-md border border-[color-mix(in_oklch,var(--warning)_35%,transparent)] bg-[color-mix(in_oklch,var(--warning)_8%,transparent)] p-3 text-sm"
        >
          <p className="font-medium text-[var(--warning)]">Review blocked</p>
          <ul className="mt-2 space-y-1 text-foreground/75">
            {requiredGaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
            {invalidRows.length > 0 && (
              <li>
                {invalidRows.length} invalid transaction {invalidRows.length === 1 ? 'row' : 'rows'}
              </li>
            )}
            {exceptions.map((exception) => (
              <li key={exception.id}>{exception.title}</li>
            ))}
            {!reconciles && <li>Reconciliation does not match the reported total</li>}
          </ul>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextField
          label={metadata.statementType === 'credit_card' ? 'Issuer' : 'Bank name'}
          value={metadata.bankName}
          onChange={(value) => updateMetadata('bankName', value)}
        />
        <TextField
          label={metadata.statementType === 'credit_card' ? 'Card last 4' : 'Account last 4'}
          value={metadata.accountLast4}
          onChange={(value) => updateMetadata('accountLast4', value)}
        />
        <TextField
          label="Period start"
          type="date"
          value={metadata.periodStart}
          onChange={(value) => updateMetadata('periodStart', value)}
        />
        <TextField
          label="Period end"
          type="date"
          value={metadata.periodEnd}
          onChange={(value) => updateMetadata('periodEnd', value)}
        />
        <TextField
          label="Opening balance"
          inputMode="decimal"
          value={metadata.openingBalance}
          onChange={(value) => updateMetadata('openingBalance', value)}
        />
        <TextField
          label="Closing balance"
          inputMode="decimal"
          value={metadata.closingBalance}
          onChange={(value) => updateMetadata('closingBalance', value)}
        />
        <TextField
          label="Reported total"
          inputMode="decimal"
          value={metadata.reportedTotal}
          onChange={(value) => updateMetadata('reportedTotal', value)}
        />
        <div className="rounded-md border border-[var(--border-subtle)] p-3 text-sm">
          <p className="text-foreground/50">Computed total</p>
          <p className="mt-1 font-semibold">{formatMoney(computedTotal)}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[70rem] text-left text-sm">
          <thead className="border-y border-[var(--border-subtle)] text-xs uppercase tracking-[0.08em] text-foreground/45">
            <tr>
              <th className="py-2 pr-3 font-semibold">Date</th>
              <th className="py-2 pr-3 font-semibold">Description</th>
              <th className="py-2 pr-3 font-semibold">Debit</th>
              <th className="py-2 pr-3 font-semibold">Credit</th>
              <th className="py-2 pr-3 font-semibold">Amount</th>
              <th className="py-2 pr-3 font-semibold">Balance</th>
              <th className="py-2 pr-3 font-semibold">Review</th>
              <th className="py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {activeRows.map((row, index) => (
              <tr
                key={row.id}
                className={
                  rowBlocksReview(row)
                    ? 'bg-[color-mix(in_oklch,var(--warning)_7%,transparent)]'
                    : ''
                }
              >
                <td className="py-3 pr-3 align-top">
                  <Input
                    ariaLabel={`Row ${index + 1} date`}
                    type="date"
                    value={row.postedAt}
                    onChange={(value) => updateRow(row.id, { postedAt: value })}
                  />
                </td>
                <td className="py-3 pr-3 align-top">
                  <Input
                    ariaLabel={`Row ${index + 1} description`}
                    value={row.description}
                    onChange={(value) => updateRow(row.id, { description: value })}
                  />
                </td>
                <td className="py-3 pr-3 align-top">
                  <Input
                    ariaLabel={`Row ${index + 1} debit`}
                    inputMode="decimal"
                    value={row.debit}
                    onChange={(value) => updateRow(row.id, { debit: value })}
                  />
                </td>
                <td className="py-3 pr-3 align-top">
                  <Input
                    ariaLabel={`Row ${index + 1} credit`}
                    inputMode="decimal"
                    value={row.credit}
                    onChange={(value) => updateRow(row.id, { credit: value })}
                  />
                </td>
                <td className="py-3 pr-3 align-top">
                  <Input
                    ariaLabel={`Row ${index + 1} amount`}
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(value) => updateRow(row.id, { amount: value })}
                  />
                </td>
                <td className="py-3 pr-3 align-top">
                  <Input
                    ariaLabel={`Row ${index + 1} balance`}
                    inputMode="decimal"
                    value={row.balance}
                    onChange={(value) => updateRow(row.id, { balance: value })}
                  />
                </td>
                <td className="py-3 pr-3 align-top">
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={row.needsReview}
                      onChange={(event) =>
                        updateRow(row.id, {
                          needsReview: event.target.checked,
                          reviewReason: event.target.checked
                            ? (row.reviewReason ?? 'Reviewer flagged this row.')
                            : null,
                        })
                      }
                    />
                    Needs review
                  </label>
                </td>
                <td className="py-3 align-top">
                  <button
                    type="button"
                    onClick={() => deleteRow(row)}
                    className="inline-flex min-h-8 items-center rounded-md border border-[var(--border-subtle)] px-2 text-xs font-medium hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border-subtle)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Add row
        </button>
        <button
          type="button"
          onClick={() => void save(false)}
          disabled={saveMode !== null}
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {saveMode === 'draft' ? 'Saving draft' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={() => void save(true)}
          disabled={reviewBlocked || saveMode !== null}
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border-subtle)] px-3 text-sm font-semibold hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {saveMode === 'review' ? 'Marking reviewed' : 'Mark reviewed'}
        </button>
      </div>
    </div>
  )
}

function TextField({
  label,
  type = 'text',
  inputMode,
  value,
  onChange,
}: {
  label: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      <span>{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded-md border border-[var(--border-subtle)] bg-background px-3 text-sm font-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      />
    </label>
  )
}

function Input({
  ariaLabel,
  type = 'text',
  inputMode,
  value,
  onChange,
}: {
  ariaLabel: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  value: string
  onChange: (value: string) => void
}) {
  return (
    <input
      aria-label={ariaLabel}
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-9 w-full rounded-md border border-[var(--border-subtle)] bg-background px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    />
  )
}

function metadataDraft(statement: EditableReviewStatement | null): MetadataDraft {
  return {
    statementType: statement?.statementType === 'credit_card' ? 'credit_card' : 'bank',
    bankName: statement?.bankName ?? '',
    accountLast4: statement?.accountLast4 ?? '',
    periodStart: statement?.periodStart ?? '',
    periodEnd: statement?.periodEnd ?? '',
    openingBalance: stringFromScalar(statement?.openingBalance),
    closingBalance: stringFromScalar(statement?.closingBalance),
    reportedTotal: stringFromScalar(statement?.reportedTotal),
    statementMetadata: normalizeStatementMetadata(statement?.statementMetadata),
  }
}

function rowDrafts(statement: EditableReviewStatement | null): RowDraft[] {
  return (
    statement?.transactions.map((transaction) => ({
      id: transaction.id,
      originalId: transaction.id,
      postedAt: transaction.postedAt ?? '',
      description: transaction.description,
      amount: stringFromScalar(transaction.amount),
      debit: stringFromScalar(transaction.debit),
      credit: stringFromScalar(transaction.credit),
      balance: stringFromScalar(transaction.balance),
      needsReview: transaction.needsReview,
      reviewReason: transaction.reviewReason,
    })) ?? []
  )
}

function statementPayload(metadata: MetadataDraft) {
  return {
    statementType: metadata.statementType,
    bankName: metadata.bankName.trim() || null,
    accountLast4: metadata.accountLast4.trim() || null,
    periodStart: metadata.periodStart.trim() || null,
    periodEnd: metadata.periodEnd.trim() || null,
    openingBalance: moneyOrNull(metadata.openingBalance),
    closingBalance: moneyOrNull(metadata.closingBalance),
    reportedTotal: moneyOrNull(metadata.reportedTotal),
    statementMetadata: metadata.statementMetadata,
  }
}

function operationsPayload(rows: RowDraft[], deletedIds: string[]) {
  return [
    ...rows.map((row) =>
      row.originalId
        ? { type: 'update' as const, id: row.originalId, patch: rowPayload(row) }
        : { type: 'add' as const, row: { id: row.id, ...rowPayload(row) } },
    ),
    ...deletedIds.map((id) => ({ type: 'delete' as const, id })),
  ]
}

function rowPayload(row: RowDraft) {
  return {
    postedAt: row.postedAt.trim() || null,
    description: row.description.trim(),
    amount: moneyOrNull(row.amount),
    debit: moneyOrNull(row.debit),
    credit: moneyOrNull(row.credit),
    balance: moneyOrNull(row.balance),
    needsReview: row.needsReview,
    reviewReason: row.reviewReason,
  }
}

function requiredMetadataGaps(metadata: MetadataDraft, rows: RowDraft[]): string[] {
  const gaps: string[] = []
  const accountLabel = metadata.statementType === 'credit_card' ? 'card last 4' : 'account last 4'
  const bankLabel = metadata.statementType === 'credit_card' ? 'issuer' : 'bank name'
  if (!metadata.bankName.trim()) gaps.push(`Missing ${bankLabel}`)
  if (!metadata.accountLast4.trim()) gaps.push(`Missing ${accountLabel}`)
  if (!metadata.periodStart.trim() || !metadata.periodEnd.trim())
    gaps.push('Missing statement period')
  if (moneyOrNull(metadata.openingBalance) === null) gaps.push('Missing opening balance')
  if (moneyOrNull(metadata.closingBalance) === null) gaps.push('Missing closing balance')
  if (moneyOrNull(metadata.reportedTotal) === null) gaps.push('Missing reported total')
  if (rows.length === 0) gaps.push('Missing transaction rows')
  return gaps
}

function rowBlocksReview(row: RowDraft): boolean {
  return (
    row.needsReview ||
    !row.postedAt.trim() ||
    !row.description.trim() ||
    (moneyOrNull(row.amount) === null &&
      moneyOrNull(row.debit) === null &&
      moneyOrNull(row.credit) === null)
  )
}

function computeStatementTotal(rows: RowDraft[], statementType: 'bank' | 'credit_card'): number {
  return roundMoney(
    rows.reduce((sum, row) => {
      const amount = moneyOrNull(row.amount)
      const debit = moneyOrNull(row.debit)
      const credit = moneyOrNull(row.credit)
      if (statementType === 'credit_card') {
        if (debit !== null) return sum + debit
        if (credit !== null) return sum - credit
        return sum + (amount ?? 0)
      }
      if (amount !== null) return sum + amount
      if (credit !== null) return sum + credit
      if (debit !== null) return sum - Math.abs(debit)
      return sum
    }, 0),
  )
}

function normalizeStatementMetadata(
  value: StatementEvidenceView['statementMetadata'] | null | undefined,
): Record<string, string | number | boolean | null> {
  const normalized: Record<string, string | number | boolean | null> = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return normalized
  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean' ||
      entry === null
    ) {
      normalized[key] = entry
    }
  }
  return normalized
}

function problemDetail(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = payload.detail
    if (typeof detail === 'string' && detail.trim().length > 0) return detail
  }
  return 'The statement edit could not be saved.'
}

function stringFromScalar(value: StatementTransactionView['amount'] | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function moneyOrNull(value: string): number | null {
  if (!value.trim()) return null
  const numeric = Number(value.replace(/[$,\s]/g, ''))
  return Number.isFinite(numeric) ? roundMoney(numeric) : null
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}
