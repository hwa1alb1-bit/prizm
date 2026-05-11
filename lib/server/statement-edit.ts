import 'server-only'

import { recordAuditEvent } from './audit'
import { getServiceRoleClient } from './supabase'
import type { Json } from '../shared/db-types'
import type { RouteContext } from './http'

const STATEMENT_EDIT_ROLES = new Set(['owner', 'admin', 'member'])

export type StatementEditOperation =
  | { type: 'update'; id: string; patch: Partial<EditableTransactionRow> }
  | { type: 'add'; row: EditableTransactionRow }
  | { type: 'delete'; id: string }

export type EditableTransactionRow = {
  id?: string
  postedAt?: string | null
  posted_at?: string | null
  date?: string | null
  description?: string | null
  amount?: number | string | null
  debit?: number | string | null
  credit?: number | string | null
  balance?: number | string | null
  payee?: string | null
  reference?: string | null
  source?: string | null
  needsReview?: boolean
  needs_review?: boolean
  reviewReason?: string | null
  review_reason?: string | null
}

export type EditableStatementMetadataPatch = {
  statementType?: 'bank' | 'credit_card'
  statement_type?: 'bank' | 'credit_card'
  statementMetadata?: Record<string, Json>
  statement_metadata?: Record<string, Json>
  bankName?: string | null
  bank_name?: string | null
  accountLast4?: string | null
  account_last4?: string | null
  periodStart?: string | null
  period_start?: string | null
  periodEnd?: string | null
  period_end?: string | null
  openingBalance?: number | string | null
  opening_balance?: number | string | null
  closingBalance?: number | string | null
  closing_balance?: number | string | null
  reportedTotal?: number | string | null
  reported_total?: number | string | null
}

export type ApplyStatementEditInput = {
  documentId: string
  actorUserId: string
  expectedRevision: number
  statement?: EditableStatementMetadataPatch
  operations: StatementEditOperation[]
  reviewed?: boolean
  actorIp: string | null
  actorUserAgent: string | null
  routeContext: RouteContext
  store?: StatementEditStore
}

export type StatementEditResult =
  | {
      ok: true
      documentId: string
      statementId: string
      revision: number
      reviewStatus: 'unreviewed' | 'reviewed'
      transactions: Json[]
      requestId: string
      traceId: string
    }
  | StatementEditProblem

export type StatementEditProblem = {
  ok: false
  status: number
  code: string
  title: string
  detail: string
}

export type StatementEditProfile = {
  workspaceId: string
  role: string
}

export type StatementReviewStatus = 'unreviewed' | 'reviewed'

export type StatementUpdateResult = 'updated' | 'revision_conflict' | 'failed'

export type StatementEditStore = {
  getUserProfile: (userId: string) => Promise<StatementEditProfile | null>
  getDocument: (workspaceId: string, documentId: string) => Promise<EditableDocumentRow | null>
  getStatement: (workspaceId: string, documentId: string) => Promise<EditableStatementRow | null>
  updateStatement: (
    statementId: string,
    expectedRevision: number,
    patch: {
      workspaceId: string
      documentId: string
      statement_type: 'bank' | 'credit_card'
      statement_metadata: Json
      bank_name: string | null
      account_last4: string | null
      period_start: string | null
      period_end: string | null
      opening_balance: number | null
      closing_balance: number | null
      reported_total: number | null
      computed_total: number
      reconciles: boolean
      transactions: Json[]
      revision: number
      review_status: StatementReviewStatus
      edited_by: string
      edited_at: string
    },
  ) => Promise<StatementUpdateResult>
  recordAudit: (input: {
    workspaceId: string
    actorUserId: string
    statementId: string
    documentId: string
    eventType: 'statement.edited' | 'statement.reviewed'
    operationCount: number
    metadataChanged: boolean
    revision: number
    actorIp: string | null
    actorUserAgent: string | null
    routeContext: RouteContext
  }) => Promise<boolean>
}

type EditableDocumentRow = {
  id: string
  status: string
  expires_at: string
  deleted_at: string | null
}

type EditableStatementRow = {
  id: string
  statement_type?: string | null
  statement_metadata?: Json | null
  bank_name?: string | null
  account_last4?: string | null
  period_start?: string | null
  period_end?: string | null
  opening_balance?: number | string | null
  closing_balance?: number | string | null
  reported_total?: number | string | null
  computed_total?: number | string | null
  reconciles?: boolean | null
  transactions: Json
  revision?: number | null
  review_status?: string | null
  expires_at: string
  deleted_at: string | null
}

type EditableStatementFields = {
  statement_type: 'bank' | 'credit_card'
  statement_metadata: Json
  bank_name: string | null
  account_last4: string | null
  period_start: string | null
  period_end: string | null
  opening_balance: number | null
  closing_balance: number | null
  reported_total: number | null
  computed_total: number
  reconciles: boolean
}

type QueryResult<T> = { data: T | null; error: { message: string } | null }

type QueryBuilder<T> = {
  eq: (column: string, value: unknown) => QueryBuilder<T>
  order: (column: string, options: { ascending: boolean }) => QueryBuilder<T>
  limit: (count: number) => Promise<QueryResult<T[]>>
  single: () => Promise<QueryResult<T>>
}

type StatementEditRpcRow = {
  updated: boolean
}

type MutationBuilder<T> = {
  eq: (column: string, value: unknown) => MutationBuilder<T>
  select: (columns: string) => MutationBuilder<T>
  single: () => Promise<QueryResult<T>>
  maybeSingle: () => Promise<QueryResult<T>>
}

type StoreClient = {
  from: (table: string) => {
    select: <T>(columns: string) => QueryBuilder<T>
    update: <T>(patch: Record<string, unknown>) => MutationBuilder<T>
  }
  rpc: (
    fn: 'update_statement_edit_if_current',
    args: Record<string, unknown>,
  ) => Promise<QueryResult<StatementEditRpcRow[]>>
}

export async function applyStatementEdit(
  input: ApplyStatementEditInput,
): Promise<StatementEditResult> {
  const store = input.store ?? createStatementEditStore()
  const profile = await store.getUserProfile(input.actorUserId)
  if (!profile)
    return problem(
      403,
      'PRZM_AUTH_WORKSPACE_REQUIRED',
      'Workspace access required',
      'The signed-in user is not attached to a workspace.',
    )

  if (!STATEMENT_EDIT_ROLES.has(profile.role)) {
    return problem(
      403,
      'PRZM_AUTH_FORBIDDEN',
      'Forbidden',
      'Owner, admin, or member access is required to edit statements.',
    )
  }

  const workspaceId = profile.workspaceId
  const document = await store.getDocument(workspaceId, input.documentId)
  if (!document)
    return problem(
      404,
      'PRZM_DOCUMENT_NOT_FOUND',
      'Document not found',
      'This document is not available in the current workspace.',
    )
  if (document.status !== 'ready')
    return problem(
      409,
      'PRZM_STATEMENT_NOT_READY',
      'Statement not ready',
      'Only ready documents can be edited.',
    )
  if (isExpired(document.expires_at) || document.deleted_at)
    return problem(
      410,
      'PRZM_DOCUMENT_EXPIRED',
      'Document expired',
      'This document is outside the active retention window.',
    )

  const statement = await store.getStatement(workspaceId, input.documentId)
  if (!statement)
    return problem(
      404,
      'PRZM_STATEMENT_NOT_FOUND',
      'Statement not found',
      'No statement was extracted for this document.',
    )
  if (isExpired(statement.expires_at) || statement.deleted_at)
    return problem(
      410,
      'PRZM_STATEMENT_EXPIRED',
      'Statement expired',
      'This statement is outside the active retention window.',
    )

  const currentRevision = statement.revision ?? 0
  if (input.expectedRevision !== currentRevision) {
    return problem(
      409,
      'PRZM_STATEMENT_REVISION_CONFLICT',
      'Statement changed',
      'Refresh the statement before editing.',
    )
  }

  const nextTransactions = applyOperations(jsonArray(statement.transactions), input.operations)
  const nextStatement = applyStatementPatch(statement, input.statement, nextTransactions)
  if (input.reviewed) {
    const readiness = reviewReadinessFor(nextStatement, nextTransactions)
    if (!readiness.ready) {
      return problem(
        409,
        'PRZM_STATEMENT_REVIEW_BLOCKED',
        'Statement review blocked',
        `Resolve ${readiness.reasons.join(', ')} before marking reviewed.`,
      )
    }
  }

  const nextRevision = currentRevision + 1
  const reviewStatus = input.reviewed ? 'reviewed' : 'unreviewed'
  const updated = await store.updateStatement(statement.id, currentRevision, {
    workspaceId,
    documentId: input.documentId,
    ...nextStatement,
    transactions: nextTransactions,
    revision: nextRevision,
    review_status: reviewStatus,
    edited_by: input.actorUserId,
    edited_at: new Date().toISOString(),
  })

  if (updated === 'revision_conflict') {
    return problem(
      409,
      'PRZM_STATEMENT_REVISION_CONFLICT',
      'Statement changed',
      'Refresh the statement before editing.',
    )
  }

  if (updated !== 'updated')
    return problem(
      500,
      'PRZM_STATEMENT_EDIT_FAILED',
      'Statement edit failed',
      'The statement edit could not be saved.',
    )

  const audited = await store.recordAudit({
    workspaceId,
    actorUserId: input.actorUserId,
    statementId: statement.id,
    documentId: input.documentId,
    eventType: input.reviewed ? 'statement.reviewed' : 'statement.edited',
    operationCount: input.operations.length,
    metadataChanged: Boolean(input.statement && Object.keys(input.statement).length > 0),
    revision: nextRevision,
    actorIp: input.actorIp,
    actorUserAgent: input.actorUserAgent,
    routeContext: input.routeContext,
  })
  if (!audited)
    return problem(
      500,
      'PRZM_STATEMENT_EDIT_AUDIT_FAILED',
      'Statement edit audit failed',
      'The statement edit was saved but audit evidence could not be recorded.',
    )

  return {
    ok: true,
    documentId: input.documentId,
    statementId: statement.id,
    revision: nextRevision,
    reviewStatus,
    transactions: nextTransactions,
    requestId: input.routeContext.requestId,
    traceId: input.routeContext.traceId,
  }
}

function applyOperations(transactions: Json[], operations: StatementEditOperation[]): Json[] {
  let next = transactions.map((row, index) => normalizePersistedTransaction(row, index))

  for (const operation of operations) {
    if (operation.type === 'add') {
      next.push(normalizeTransaction(operation.row, next.length))
      continue
    }

    if (operation.type === 'delete') {
      next = next.filter((row) => transactionId(row) !== operation.id)
      continue
    }

    next = next.map((row, index) =>
      transactionId(row) === operation.id
        ? normalizeTransaction({ ...(objectRow(row) ?? {}), ...operation.patch }, index)
        : row,
    )
  }

  return next
}

function normalizePersistedTransaction(row: Json, index: number): Json {
  const object = objectRow(row)
  return normalizeTransaction((object ?? {}) as EditableTransactionRow, index)
}

function applyStatementPatch(
  statement: EditableStatementRow,
  patch: EditableStatementMetadataPatch | undefined,
  transactions: Json[],
): EditableStatementFields {
  const statementType = normalizeStatementType(
    withFallback(patchField(patch, 'statementType', 'statement_type'), statement.statement_type),
  )
  const statementMetadata = normalizeMetadata(
    withFallback(
      patchField(patch, 'statementMetadata', 'statement_metadata'),
      statement.statement_metadata,
    ),
  )
  const reportedTotal = normalizeMoney(
    withFallback(patchField(patch, 'reportedTotal', 'reported_total'), statement.reported_total),
  )
  const computedTotal = computeStatementTotal(transactions, statementType)

  return {
    statement_type: statementType,
    statement_metadata: statementMetadata,
    bank_name: normalizeText(
      withFallback(patchField(patch, 'bankName', 'bank_name'), statement.bank_name),
    ),
    account_last4: normalizeText(
      withFallback(patchField(patch, 'accountLast4', 'account_last4'), statement.account_last4),
    ),
    period_start: normalizeText(
      withFallback(patchField(patch, 'periodStart', 'period_start'), statement.period_start),
    ),
    period_end: normalizeText(
      withFallback(patchField(patch, 'periodEnd', 'period_end'), statement.period_end),
    ),
    opening_balance: normalizeMoney(
      withFallback(
        patchField(patch, 'openingBalance', 'opening_balance'),
        statement.opening_balance,
      ),
    ),
    closing_balance: normalizeMoney(
      withFallback(
        patchField(patch, 'closingBalance', 'closing_balance'),
        statement.closing_balance,
      ),
    ),
    reported_total: reportedTotal,
    computed_total: computedTotal,
    reconciles: reportedTotal !== null && computedTotal === reportedTotal,
  }
}

function reviewReadinessFor(
  statement: EditableStatementFields,
  transactions: Json[],
): { ready: boolean; reasons: string[] } {
  const reasons: string[] = []
  const isCreditCard = statement.statement_type === 'credit_card'

  if (!hasText(statement.bank_name)) reasons.push(isCreditCard ? 'issuer' : 'bank name')
  if (!hasText(statement.account_last4))
    reasons.push(isCreditCard ? 'card last 4' : 'account last 4')
  if (!hasText(statement.period_start) || !hasText(statement.period_end)) {
    reasons.push('statement period')
  }
  if (!hasMoney(statement.opening_balance)) reasons.push('opening balance')
  if (!hasMoney(statement.closing_balance)) reasons.push('closing balance')
  if (!hasMoney(statement.reported_total)) reasons.push('reported total')
  if (transactions.length === 0) reasons.push('transaction rows')

  const invalidRowCount = transactions.filter(transactionBlocksReview).length
  if (invalidRowCount > 0) {
    reasons.push(`${invalidRowCount} invalid transaction ${invalidRowCount === 1 ? 'row' : 'rows'}`)
  }

  if (statement.reconciles !== true) reasons.push('reconciliation')

  return { ready: reasons.length === 0, reasons }
}

function patchField(
  patch: EditableStatementMetadataPatch | undefined,
  camelKey: keyof EditableStatementMetadataPatch,
  snakeKey: keyof EditableStatementMetadataPatch,
): unknown {
  if (!patch) return undefined
  if (Object.prototype.hasOwnProperty.call(patch, camelKey)) return patch[camelKey]
  if (Object.prototype.hasOwnProperty.call(patch, snakeKey)) return patch[snakeKey]
  return undefined
}

function withFallback(value: unknown, fallback: unknown): unknown {
  return value === undefined ? fallback : value
}

function normalizeStatementType(value: unknown): 'bank' | 'credit_card' {
  return value === 'credit_card' ? 'credit_card' : 'bank'
}

function normalizeMetadata(value: unknown): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Json
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeMoney(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return roundMoney(value)
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const numeric = Number(value.replace(/[$,\s]/g, ''))
  return Number.isFinite(numeric) ? roundMoney(numeric) : null
}

function computeStatementTotal(
  transactions: Json[],
  statementType: 'bank' | 'credit_card',
): number {
  return roundMoney(
    transactions.reduce<number>(
      (sum, transaction) => sum + transactionSignedAmount(transaction, statementType),
      0,
    ),
  )
}

function transactionSignedAmount(transaction: Json, statementType: 'bank' | 'credit_card'): number {
  const row = objectRow(transaction)
  if (!row) return 0

  const amount = numericValue(row, ['amount'])
  const debit = numericValue(row, ['debit', 'withdrawal', 'outflow'])
  const credit = numericValue(row, ['credit', 'deposit', 'inflow'])

  if (statementType === 'credit_card') {
    if (debit !== null) return debit
    if (credit !== null) return -credit
    return amount ?? 0
  }

  if (amount !== null) return amount
  if (credit !== null) return credit
  if (debit !== null) return -Math.abs(debit)
  return 0
}

function numericValue(
  row: Record<string, Json | undefined>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim().length > 0) {
      const numeric = Number(value.replace(/[$,\s]/g, ''))
      if (Number.isFinite(numeric)) return numeric
    }
  }
  return null
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function transactionBlocksReview(row: Json): boolean {
  const object = objectRow(row)
  if (!object) return true
  if (booleanValue(object, ['needs_review', 'needsReview', 'flagged'])) return true
  return (
    !hasTransactionDate(object) ||
    !hasTransactionDescription(object) ||
    !hasTransactionAmount(object)
  )
}

function hasTransactionDate(row: Record<string, Json | undefined>): boolean {
  return stringValue(row, ['posted_at', 'postedAt', 'date', 'transaction_date']) !== null
}

function hasTransactionDescription(row: Record<string, Json | undefined>): boolean {
  return stringValue(row, ['description', 'memo', 'details', 'name']) !== null
}

function hasTransactionAmount(row: Record<string, Json | undefined>): boolean {
  return (
    moneyValue(row, ['amount']) !== null ||
    moneyValue(row, ['debit', 'withdrawal', 'outflow']) !== null ||
    moneyValue(row, ['credit', 'deposit', 'inflow']) !== null
  )
}

function normalizeTransaction(row: EditableTransactionRow, index: number): Json {
  const id = typeof row.id === 'string' && row.id.length > 0 ? row.id : `row_${index + 1}`
  return {
    ...row,
    id,
    posted_at: row.posted_at ?? row.postedAt ?? row.date ?? null,
    description: row.description ?? '',
    amount: row.amount ?? null,
    debit: row.debit ?? null,
    credit: row.credit ?? null,
    balance: row.balance ?? null,
    needs_review: row.needs_review ?? row.needsReview ?? false,
    review_reason: row.review_reason ?? row.reviewReason ?? null,
  }
}

function transactionId(row: Json): string | null {
  const object = objectRow(row)
  const id = object?.id
  return typeof id === 'string' ? id : null
}

function objectRow(row: Json): Record<string, Json | undefined> | null {
  return row && typeof row === 'object' && !Array.isArray(row) ? row : null
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasMoney(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Number(value))
}

function stringValue(
  row: Record<string, Json | undefined>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}

function moneyValue(
  row: Record<string, Json | undefined>,
  keys: readonly string[],
): number | string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Number(value))) {
      return value.trim()
    }
  }
  return null
}

function booleanValue(row: Record<string, Json | undefined>, keys: readonly string[]): boolean {
  for (const key of keys) {
    if (typeof row[key] === 'boolean') return row[key] as boolean
  }
  return false
}

function jsonArray(value: Json): Json[] {
  return Array.isArray(value) ? value : []
}

function isExpired(value: string): boolean {
  return new Date(value).getTime() <= Date.now()
}

function problem(
  status: number,
  code: string,
  title: string,
  detail: string,
): StatementEditProblem {
  return { ok: false, status, code, title, detail }
}

function createStatementEditStore(): StatementEditStore {
  const client = getServiceRoleClient() as unknown as StoreClient
  return {
    async getUserProfile(userId) {
      const { data, error } = await client
        .from('user_profile')
        .select<{ workspace_id: string; role: string }>('workspace_id, role')
        .eq('id', userId)
        .limit(1)
      if (error) throw new Error('workspace_lookup_failed')
      const profile = data?.[0]
      return profile ? { workspaceId: profile.workspace_id, role: profile.role } : null
    },
    async getDocument(workspaceId, documentId) {
      const { data, error } = await client
        .from('document')
        .select<EditableDocumentRow>('id, status, expires_at, deleted_at')
        .eq('workspace_id', workspaceId)
        .eq('id', documentId)
        .limit(1)
      if (error) throw new Error('document_lookup_failed')
      return data?.[0] ?? null
    },
    async getStatement(workspaceId, documentId) {
      const { data, error } = await client
        .from('statement')
        .select<EditableStatementRow>(
          [
            'id',
            'statement_type',
            'statement_metadata',
            'bank_name',
            'account_last4',
            'period_start',
            'period_end',
            'opening_balance',
            'closing_balance',
            'reported_total',
            'computed_total',
            'reconciles',
            'transactions',
            'revision',
            'review_status',
            'expires_at',
            'deleted_at',
          ].join(', '),
        )
        .eq('workspace_id', workspaceId)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw new Error('statement_lookup_failed')
      return data?.[0] ?? null
    },
    async updateStatement(statementId, expectedRevision, patch) {
      const { data, error } = await client.rpc('update_statement_edit_if_current', {
        p_statement_id: statementId,
        p_workspace_id: patch.workspaceId,
        p_document_id: patch.documentId,
        p_expected_revision: expectedRevision,
        p_statement_type: patch.statement_type,
        p_statement_metadata: patch.statement_metadata,
        p_bank_name: patch.bank_name,
        p_account_last4: patch.account_last4,
        p_period_start: patch.period_start,
        p_period_end: patch.period_end,
        p_opening_balance: patch.opening_balance,
        p_closing_balance: patch.closing_balance,
        p_reported_total: patch.reported_total,
        p_computed_total: patch.computed_total,
        p_reconciles: patch.reconciles,
        p_transactions: patch.transactions,
        p_revision: patch.revision,
        p_review_status: patch.review_status,
        p_edited_by: patch.edited_by,
        p_edited_at: patch.edited_at,
      })
      if (error) return 'failed'
      return data?.[0]?.updated ? 'updated' : 'revision_conflict'
    },
    async recordAudit(input) {
      const result = await recordAuditEvent({
        eventType: input.eventType,
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        actorIp: input.actorIp,
        actorUserAgent: input.actorUserAgent,
        targetType: 'statement',
        targetId: input.statementId,
        metadata: {
          document_id: input.documentId,
          operation_count: input.operationCount,
          metadata_changed: input.metadataChanged,
          review_status: input.eventType === 'statement.reviewed' ? 'reviewed' : 'unreviewed',
          revision: input.revision,
          request_id: input.routeContext.requestId,
          trace_id: input.routeContext.traceId,
        },
      })
      return result.ok
    },
  }
}
