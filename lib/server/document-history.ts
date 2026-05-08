import 'server-only'

import { requireAuthenticatedUser } from './route-auth'
import { getServiceRoleClient } from './supabase'
import type { Json } from '../shared/db-types'

export const DOCUMENT_STATES = [
  'pending',
  'verified',
  'processing',
  'ready',
  'failed',
  'expired',
] as const

export type DocumentState = (typeof DOCUMENT_STATES)[number]

export type StatementTransactionView = {
  id: string
  postedAt: string | null
  description: string
  amount: number | string | null
  debit: number | string | null
  credit: number | string | null
  balance: number | string | null
  confidence: number | null
  source: string | null
  needsReview: boolean
  reviewReason: string | null
}

export type StatementEvidenceView = {
  id: string
  statementType: StatementType
  statementMetadata: StatementMetadata
  reviewStatus: string | null
  bankName: string | null
  accountLast4: string | null
  periodStart: string | null
  periodEnd: string | null
  openingBalance: number | string | null
  closingBalance: number | string | null
  reportedTotal: number | string | null
  computedTotal: number | string | null
  reconciles: boolean | null
  transactionCount: number
  transactions: StatementTransactionView[]
  createdAt: string
  expiresAt: string
  deletedAt: string | null
}

export type AuditEventEvidenceView = {
  id: string
  eventType: string
  createdAt: string
  actorUserId: string | null
  requestId: string | null
  traceId: string | null
}

export type DeletionEvidenceView = {
  receiptStatus: 'sent' | 'failed' | null
  receiptSentAt: string | null
  receiptErrorCode: string | null
  deletionAuditedAt: string | null
}

export type HistoryDocumentView = {
  id: string
  filename: string
  state: DocumentState
  createdAt: string
  expiresAt: string
  deletedAt: string | null
  failureReason: string | null
  sizeBytes: number
  contentType: string
  pages: number | null
  s3Bucket: string
  s3Key: string
  textractJobId: string | null
  statements: StatementEvidenceView[]
  auditEvents: AuditEventEvidenceView[]
  deletionEvidence: DeletionEvidenceView | null
}

export type DocumentHistoryLoadResult =
  | { ok: true; documents: HistoryDocumentView[] }
  | { ok: false; reason: LoadFailureReason; title: string; detail: string }

export type DocumentReviewLoadResult =
  | { ok: true; document: HistoryDocumentView }
  | { ok: false; reason: LoadFailureReason | 'not_found'; title: string; detail: string }

type LoadFailureReason = 'unauthenticated' | 'workspace_required' | 'unavailable'
type LoadFailure = { ok: false; reason: LoadFailureReason; title: string; detail: string }
type StatementType = 'bank' | 'credit_card'
type StatementMetadata = { [key: string]: Json | undefined }

type DbError = { message: string }
type QueryResult<T> = { data: T | null; error: DbError | null }

type QueryBuilder<T> = {
  eq: (column: string, value: unknown) => QueryBuilder<T>
  in: (column: string, values: readonly string[]) => QueryBuilder<T>
  order: (column: string, options: { ascending: boolean }) => QueryBuilder<T>
  limit: (count: number) => Promise<QueryResult<T[]>>
}

type TableBuilder = {
  select: <T>(columns: string) => QueryBuilder<T>
}

type HistoryStoreClient = {
  from: (table: string) => TableBuilder
}

type ProfileRow = {
  workspace_id: string
}

type DocumentRow = {
  id: string
  filename: string
  status: string
  created_at: string
  expires_at: string
  deleted_at: string | null
  failure_reason: string | null
  size_bytes: number
  content_type: string
  pages: number | null
  s3_bucket: string
  s3_key: string
  textract_job_id: string | null
}

type StatementRow = {
  id: string
  document_id: string
  statement_type?: string | null
  statement_metadata?: Json | null
  review_status?: string | null
  bank_name: string | null
  account_last4: string | null
  period_start: string | null
  period_end: string | null
  opening_balance: number | string | null
  closing_balance: number | string | null
  reported_total: number | string | null
  computed_total: number | string | null
  reconciles: boolean | null
  transactions: Json
  created_at: string
  expires_at: string
  deleted_at: string | null
}

type AuditEventRow = {
  id: string
  target_id: string | null
  event_type: string
  created_at: string
  actor_user_id: string | null
  metadata: Json | null
}

type DeletionEvidenceRow = {
  document_id: string
  receipt_status: 'sent' | 'failed' | null
  receipt_sent_at: string | null
  receipt_error_code: string | null
  deletion_audited_at: string | null
}

export async function loadDocumentHistoryForCurrentUser(): Promise<DocumentHistoryLoadResult> {
  const auth = await requireAuthenticatedUser()
  if (!auth.ok) return authProblem(auth.problem.status, auth.problem.title, auth.problem.detail)

  try {
    const workspaceId = await getWorkspaceIdForUser(auth.context.user.id)
    if (!workspaceId) return workspaceRequired()

    const documents = await listDocumentHistoryForWorkspace(workspaceId)
    return { ok: true, documents }
  } catch {
    return unavailableProblem()
  }
}

export async function loadDocumentReviewForCurrentUser(
  documentId: string,
): Promise<DocumentReviewLoadResult> {
  const auth = await requireAuthenticatedUser()
  if (!auth.ok) return authProblem(auth.problem.status, auth.problem.title, auth.problem.detail)

  try {
    const workspaceId = await getWorkspaceIdForUser(auth.context.user.id)
    if (!workspaceId) return workspaceRequired()

    const document = await getDocumentHistoryForWorkspace(workspaceId, documentId)
    if (!document) {
      return {
        ok: false,
        reason: 'not_found',
        title: 'Document not found',
        detail: 'This document is not available in the current workspace.',
      }
    }

    return { ok: true, document }
  } catch {
    return unavailableProblem()
  }
}

export async function listDocumentHistoryForWorkspace(
  workspaceId: string,
): Promise<HistoryDocumentView[]> {
  const client = getHistoryStoreClient()
  const { data, error } = await client
    .from('document')
    .select<DocumentRow>(
      [
        'id',
        'filename',
        'status',
        'created_at',
        'expires_at',
        'deleted_at',
        'failure_reason',
        'size_bytes',
        'content_type',
        'pages',
        's3_bucket',
        's3_key',
        'textract_job_id',
      ].join(', '),
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error('document_history_read_failed')
  return hydrateDocuments(workspaceId, data ?? [])
}

async function getDocumentHistoryForWorkspace(
  workspaceId: string,
  documentId: string,
): Promise<HistoryDocumentView | null> {
  const client = getHistoryStoreClient()
  const { data, error } = await client
    .from('document')
    .select<DocumentRow>(
      [
        'id',
        'filename',
        'status',
        'created_at',
        'expires_at',
        'deleted_at',
        'failure_reason',
        'size_bytes',
        'content_type',
        'pages',
        's3_bucket',
        's3_key',
        'textract_job_id',
      ].join(', '),
    )
    .eq('workspace_id', workspaceId)
    .eq('id', documentId)
    .limit(1)

  if (error) throw new Error('document_review_read_failed')
  const documents = await hydrateDocuments(workspaceId, data ?? [])
  return documents[0] ?? null
}

async function getWorkspaceIdForUser(userId: string): Promise<string | null> {
  const { data, error } = await getHistoryStoreClient()
    .from('user_profile')
    .select<ProfileRow>('workspace_id')
    .eq('id', userId)
    .limit(1)

  if (error) throw new Error('workspace_profile_read_failed')
  return data?.[0]?.workspace_id ?? null
}

async function hydrateDocuments(
  workspaceId: string,
  documents: DocumentRow[],
): Promise<HistoryDocumentView[]> {
  if (documents.length === 0) return []

  const documentIds = documents.map((document) => document.id)
  const [statements, auditEvents, deletionEvidence] = await Promise.all([
    listStatementsForDocuments(workspaceId, documentIds),
    listAuditEventsForDocuments(workspaceId, documentIds),
    listDeletionEvidenceForDocuments(workspaceId, documentIds),
  ])

  const statementsByDocument = groupBy(statements, (statement) => statement.document_id)
  const auditEventsByDocument = groupBy(
    auditEvents.filter((event) => event.target_id),
    (event) => event.target_id ?? '',
  )
  const deletionByDocument = new Map(
    deletionEvidence.map((evidence) => [evidence.document_id, evidence]),
  )

  return documents.map((document) => ({
    id: document.id,
    filename: document.filename,
    state: normalizeDocumentState(document.status),
    createdAt: document.created_at,
    expiresAt: document.expires_at,
    deletedAt: document.deleted_at,
    failureReason: document.failure_reason,
    sizeBytes: document.size_bytes,
    contentType: document.content_type,
    pages: document.pages,
    s3Bucket: document.s3_bucket,
    s3Key: document.s3_key,
    textractJobId: document.textract_job_id,
    statements: (statementsByDocument.get(document.id) ?? []).map(statementView),
    auditEvents: (auditEventsByDocument.get(document.id) ?? []).map(auditEventView),
    deletionEvidence: deletionView(deletionByDocument.get(document.id) ?? null),
  }))
}

async function listStatementsForDocuments(
  workspaceId: string,
  documentIds: readonly string[],
): Promise<StatementRow[]> {
  const { data, error } = await getHistoryStoreClient()
    .from('statement')
    .select<StatementRow>(
      [
        'id',
        'document_id',
        'statement_type',
        'statement_metadata',
        'review_status',
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
        'created_at',
        'expires_at',
        'deleted_at',
      ].join(', '),
    )
    .eq('workspace_id', workspaceId)
    .in('document_id', documentIds)
    .order('created_at', { ascending: false })
    .limit(Math.max(50, documentIds.length * 5))

  if (error) throw new Error('statement_history_read_failed')
  return data ?? []
}

async function listAuditEventsForDocuments(
  workspaceId: string,
  documentIds: readonly string[],
): Promise<AuditEventRow[]> {
  const { data, error } = await getHistoryStoreClient()
    .from('audit_event')
    .select<AuditEventRow>('id, target_id, event_type, created_at, actor_user_id, metadata')
    .eq('workspace_id', workspaceId)
    .eq('target_type', 'document')
    .in('target_id', documentIds)
    .order('created_at', { ascending: false })
    .limit(Math.max(100, documentIds.length * 10))

  if (error) throw new Error('audit_history_read_failed')
  return data ?? []
}

async function listDeletionEvidenceForDocuments(
  workspaceId: string,
  documentIds: readonly string[],
): Promise<DeletionEvidenceRow[]> {
  const { data, error } = await getHistoryStoreClient()
    .from('deletion_evidence')
    .select<DeletionEvidenceRow>(
      'document_id, receipt_status, receipt_sent_at, receipt_error_code, deletion_audited_at',
    )
    .eq('workspace_id', workspaceId)
    .in('document_id', documentIds)
    .limit(documentIds.length)

  if (error) throw new Error('deletion_evidence_read_failed')
  return data ?? []
}

export function documentStateLabel(state: DocumentState): string {
  switch (state) {
    case 'pending':
      return 'Pending'
    case 'verified':
      return 'Verified'
    case 'processing':
      return 'Processing'
    case 'ready':
      return 'Ready'
    case 'failed':
      return 'Failed'
    case 'expired':
      return 'Expired'
  }
}

function normalizeDocumentState(status: string): DocumentState {
  if (DOCUMENT_STATES.includes(status as DocumentState)) return status as DocumentState
  return 'failed'
}

function statementView(row: StatementRow): StatementEvidenceView {
  const transactions = transactionViews(row.transactions)

  return {
    id: row.id,
    statementType: normalizeStatementType(row.statement_type),
    statementMetadata: normalizeStatementMetadata(row.statement_metadata),
    reviewStatus: row.review_status ?? null,
    bankName: row.bank_name,
    accountLast4: row.account_last4,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    openingBalance: row.opening_balance,
    closingBalance: row.closing_balance,
    reportedTotal: row.reported_total,
    computedTotal: row.computed_total,
    reconciles: row.reconciles,
    transactionCount: transactions.length,
    transactions,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    deletedAt: row.deleted_at,
  }
}

function normalizeStatementType(value: string | null | undefined): StatementType {
  return value === 'credit_card' ? 'credit_card' : 'bank'
}

function normalizeStatementMetadata(value: Json | null | undefined): StatementMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value
}

function transactionViews(value: Json): StatementTransactionView[] {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => transactionView(item, index))
}

function transactionView(value: Json, index: number): StatementTransactionView {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      id: `row_${index + 1}`,
      postedAt: null,
      description: 'Unstructured transaction row',
      amount: null,
      debit: null,
      credit: null,
      balance: null,
      confidence: null,
      source: null,
      needsReview: true,
      reviewReason: 'Transaction evidence was not returned as an object.',
    }
  }

  const row = value as Record<string, Json | undefined>
  const postedAt = firstString(row, ['posted_at', 'postedAt', 'date', 'transaction_date'])
  const description =
    firstString(row, ['description', 'memo', 'payee', 'details', 'name']) ?? 'Description missing'
  const amount = firstScalar(row, ['amount', 'transaction_amount', 'value'])
  const debit = firstScalar(row, ['debit', 'withdrawal', 'outflow'])
  const credit = firstScalar(row, ['credit', 'deposit', 'inflow'])
  const balance = firstScalar(row, ['balance', 'running_balance'])
  const confidence = firstNumber(row, ['confidence', 'ocr_confidence'])
  const explicitReviewReason = firstString(row, [
    'review_reason',
    'reviewReason',
    'exception',
    'issue',
    'error',
  ])
  const source = transactionSource(row)
  const explicitNeedsReview = firstBoolean(row, ['needs_review', 'needsReview', 'flagged'])
  const missing: string[] = []

  if (!postedAt) missing.push('date')
  if (description === 'Description missing') missing.push('description')
  if (amount === null && debit === null && credit === null) missing.push('amount')

  const confidenceNeedsReview = confidence !== null && confidence < 0.85
  const reviewReason =
    explicitReviewReason ??
    (missing.length > 0 ? `Missing ${missing.join(', ')} evidence.` : null) ??
    (confidenceNeedsReview ? `OCR confidence is ${Math.round(confidence * 100)}%.` : null)

  return {
    id: firstString(row, ['id', 'transaction_id', 'row_id']) ?? `row_${index + 1}`,
    postedAt,
    description,
    amount,
    debit,
    credit,
    balance,
    confidence,
    source,
    needsReview: explicitNeedsReview ?? reviewReason !== null,
    reviewReason,
  }
}

function firstString(
  row: Record<string, Json | undefined>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}

function firstNumber(
  row: Record<string, Json | undefined>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const numeric = Number(value)
      if (Number.isFinite(numeric)) return numeric
    }
  }
  return null
}

function firstScalar(
  row: Record<string, Json | undefined>,
  keys: readonly string[],
): number | string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}

function firstBoolean(
  row: Record<string, Json | undefined>,
  keys: readonly string[],
): boolean | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'boolean') return value
  }
  return null
}

function transactionSource(row: Record<string, Json | undefined>): string | null {
  const explicit = firstString(row, ['source', 'source_id', 'evidence_id', 'textract_block_id'])
  if (explicit) return explicit

  const page = firstNumber(row, ['page', 'page_number'])
  const line = firstNumber(row, ['line', 'line_number'])
  if (page !== null && line !== null) return `Page ${page}, line ${line}`
  if (page !== null) return `Page ${page}`

  return null
}

function auditEventView(row: AuditEventRow): AuditEventEvidenceView {
  return {
    id: row.id,
    eventType: row.event_type,
    createdAt: row.created_at,
    actorUserId: row.actor_user_id,
    requestId: metadataString(row.metadata, 'request_id'),
    traceId: metadataString(row.metadata, 'trace_id'),
  }
}

function deletionView(row: DeletionEvidenceRow | null): DeletionEvidenceView | null {
  if (!row) return null
  return {
    receiptStatus: row.receipt_status,
    receiptSentAt: row.receipt_sent_at,
    receiptErrorCode: row.receipt_error_code,
    deletionAuditedAt: row.deletion_audited_at,
  }
}

function metadataString(metadata: Json | null, key: string): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = metadata[key]
  return typeof value === 'string' ? value : null
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = getKey(item)
    const current = groups.get(key)
    if (current) current.push(item)
    else groups.set(key, [item])
  }
  return groups
}

function authProblem(status: number, title: string, detail: string): LoadFailure {
  if (status === 401) {
    return {
      ok: false,
      reason: 'unauthenticated',
      title: 'Authentication required',
      detail: 'Sign in to view statement history.',
    }
  }

  return { ok: false, reason: 'unavailable', title, detail }
}

function workspaceRequired(): LoadFailure {
  return {
    ok: false,
    reason: 'workspace_required',
    title: 'Workspace access required',
    detail: 'The signed-in user is not attached to a workspace.',
  }
}

function unavailableProblem(): LoadFailure {
  return {
    ok: false,
    reason: 'unavailable',
    title: 'History is unavailable',
    detail: 'Document evidence could not be loaded. Try again shortly.',
  }
}

function getHistoryStoreClient(): HistoryStoreClient {
  return getServiceRoleClient() as unknown as HistoryStoreClient
}
