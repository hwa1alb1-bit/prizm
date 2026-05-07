import 'server-only'

import { getServiceRoleClient } from '../supabase'

export type DeletionSweepTrigger = 'cron' | 'manual' | 'test'

export type ExpiredDocumentCandidate = {
  id: string
  workspaceId: string
  uploadedBy: string
  recipientEmail: string | null
  filename: string
  s3Bucket: string
  s3Key: string
  expiresAt: string
}

export type ExpiredStatementCandidate = {
  id: string
  documentId: string
  workspaceId: string
  expiresAt: string
}

export type DeletionReceiptRecord = {
  documentId: string
  workspaceId: string
  recipientUserId: string
  recipientEmail: string
  sentAt: string
  status: 'sent' | 'failed'
  errorCode: string | null
}

export type DeletionSweepRunRecord = {
  trigger: DeletionSweepTrigger
  startedAt: string
  finishedAt: string
  status: 'ok' | 'partial' | 'failed'
  expiredDocumentCount: number
  expiredStatementCount: number
  deletedDocumentCount: number
  deletedStatementCount: number
  s3DeletedCount: number
  s3AbsentCount: number
  receiptCount: number
  receiptFailureCount: number
  survivorCount: number
  errorDetail: string | null
}

export type DeletionSurvivorSummary = {
  documentSurvivors: number
  statementSurvivors: number
}

export type DeletionHealth = {
  status: 'green' | 'yellow' | 'red' | 'gray'
  lastSweepAt: string | null
  lastSweepStatus: 'ok' | 'partial' | 'failed' | null
  expiredSurvivors: number
  receiptFailures: number
}

type DbError = { message: string }
type QueryResult<T> = { data: T | null; error: DbError | null }

type SelectBuilder<T> = {
  lt: (column: string, value: string) => SelectBuilder<T>
  is: (column: string, value: null) => SelectBuilder<T>
  order: (column: string, options: { ascending: boolean }) => SelectBuilder<T>
  limit: (count: number) => Promise<QueryResult<T[]>>
}

type UpdateBuilder = {
  eq: (column: string, value: string) => UpdateBuilder
  select: (columns: string) => Promise<QueryResult<Array<{ id: string }>>>
}

type TableBuilder = {
  select: <T>(columns: string) => SelectBuilder<T>
  update: (payload: Record<string, unknown>) => UpdateBuilder
  insert: (payload: unknown) => Promise<QueryResult<unknown>>
}

type ServiceRoleLike = {
  from: (table: string) => TableBuilder
}

type DocumentRow = {
  id: string
  workspace_id: string
  uploaded_by: string
  s3_bucket: string
  s3_key: string
  filename: string
  expires_at: string
  user_profile: { email: string | null } | Array<{ email: string | null }> | null
}

type StatementRow = {
  id: string
  document_id: string
  workspace_id: string
  expires_at: string
}

type DeletionSweepRunRow = {
  started_at: string
  status: 'ok' | 'partial' | 'failed'
  receipt_failure_count: number
}

export async function listExpiredDocuments(input: {
  now: string
  limit: number
}): Promise<ExpiredDocumentCandidate[]> {
  const client = getDeletionStoreClient()
  const { data, error } = await client
    .from('document')
    .select<DocumentRow>(
      'id, workspace_id, uploaded_by, s3_bucket, s3_key, filename, expires_at, user_profile!document_uploaded_by_fkey(email)',
    )
    .lt('expires_at', input.now)
    .is('deleted_at', null)
    .limit(input.limit)

  if (error) throw new Error('expired_document_read_failed')

  return (data ?? []).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    uploadedBy: row.uploaded_by,
    recipientEmail: normalizeProfileEmail(row.user_profile),
    filename: row.filename,
    s3Bucket: row.s3_bucket,
    s3Key: row.s3_key,
    expiresAt: row.expires_at,
  }))
}

export async function listExpiredStatements(input: {
  now: string
  limit: number
}): Promise<ExpiredStatementCandidate[]> {
  const client = getDeletionStoreClient()
  const { data, error } = await client
    .from('statement')
    .select<StatementRow>('id, document_id, workspace_id, expires_at')
    .lt('expires_at', input.now)
    .is('deleted_at', null)
    .limit(input.limit)

  if (error) throw new Error('expired_statement_read_failed')

  return (data ?? []).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    workspaceId: row.workspace_id,
    expiresAt: row.expires_at,
  }))
}

export async function markDocumentDeleted(input: {
  documentId: string
  deletedAt: string
}): Promise<void> {
  const { error } = await getDeletionStoreClient()
    .from('document')
    .update(documentDeletionScrubPayload(input.deletedAt))
    .eq('id', input.documentId)
    .select('id')

  if (error) throw new Error('document_delete_mark_failed')
}

export async function markStatementsDeletedForDocument(input: {
  documentId: string
  deletedAt: string
}): Promise<number> {
  const { data, error } = await getDeletionStoreClient()
    .from('statement')
    .update(statementDeletionScrubPayload(input.deletedAt))
    .eq('document_id', input.documentId)
    .select('id')

  if (error) throw new Error('statement_delete_mark_failed')
  return data?.length ?? 0
}

export async function markStatementDeleted(input: {
  statementId: string
  deletedAt: string
}): Promise<void> {
  const { error } = await getDeletionStoreClient()
    .from('statement')
    .update(statementDeletionScrubPayload(input.deletedAt))
    .eq('id', input.statementId)
    .select('id')

  if (error) throw new Error('statement_delete_mark_failed')
}

export async function recordDeletionReceipt(input: DeletionReceiptRecord): Promise<void> {
  const { error } = await getDeletionStoreClient().from('deletion_receipt').insert({
    document_id: input.documentId,
    workspace_id: input.workspaceId,
    recipient_user_id: input.recipientUserId,
    recipient_email: input.recipientEmail,
    sent_at: input.sentAt,
    status: input.status,
    error_code: input.errorCode,
  })

  if (error) throw new Error('deletion_receipt_write_failed')
}

export async function recordDeletionSweepRun(input: DeletionSweepRunRecord): Promise<void> {
  const { error } = await getDeletionStoreClient().from('deletion_sweep_run').insert({
    trigger: input.trigger,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    status: input.status,
    expired_document_count: input.expiredDocumentCount,
    expired_statement_count: input.expiredStatementCount,
    deleted_document_count: input.deletedDocumentCount,
    deleted_statement_count: input.deletedStatementCount,
    s3_deleted_count: input.s3DeletedCount,
    s3_absent_count: input.s3AbsentCount,
    receipt_count: input.receiptCount,
    receipt_failure_count: input.receiptFailureCount,
    survivor_count: input.survivorCount,
    error_detail: input.errorDetail,
  })

  if (error) throw new Error('deletion_sweep_run_write_failed')
}

export async function listStaleDeletionSurvivors(input: {
  olderThan: string
  limit?: number
}): Promise<DeletionSurvivorSummary> {
  const limit = input.limit ?? 500
  const client = getDeletionStoreClient()
  const [documents, statements] = await Promise.all([
    client
      .from('document')
      .select<{ id: string }>('id')
      .lt('expires_at', input.olderThan)
      .is('deleted_at', null)
      .limit(limit),
    client
      .from('statement')
      .select<{ id: string }>('id')
      .lt('expires_at', input.olderThan)
      .is('deleted_at', null)
      .limit(limit),
  ])

  if (documents.error || statements.error) throw new Error('deletion_survivor_read_failed')

  return {
    documentSurvivors: documents.data?.length ?? 0,
    statementSurvivors: statements.data?.length ?? 0,
  }
}

export async function listDeletionHealth(input: { now?: Date } = {}): Promise<DeletionHealth> {
  const now = input.now ?? new Date()
  const olderThan = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
  const [survivors, latest] = await Promise.all([
    listStaleDeletionSurvivors({ olderThan }),
    getDeletionStoreClient()
      .from('deletion_sweep_run')
      .select<DeletionSweepRunRow>('started_at, status, receipt_failure_count')
      .order('started_at', { ascending: false })
      .limit(1),
  ])

  if (latest.error) throw new Error('deletion_health_read_failed')

  const latestRun = latest.data?.[0] ?? null
  const expiredSurvivors = survivors.documentSurvivors + survivors.statementSurvivors
  const receiptFailures = latestRun?.receipt_failure_count ?? 0
  const lastSweepStatus = latestRun?.status ?? null

  return {
    status: deletionHealthStatus({
      expiredSurvivors,
      receiptFailures,
      lastSweepStatus,
    }),
    lastSweepAt: latestRun?.started_at ?? null,
    lastSweepStatus,
    expiredSurvivors,
    receiptFailures,
  }
}

function deletionHealthStatus(input: {
  expiredSurvivors: number
  receiptFailures: number
  lastSweepStatus: 'ok' | 'partial' | 'failed' | null
}): DeletionHealth['status'] {
  if (input.expiredSurvivors > 0 || input.lastSweepStatus === 'failed') return 'red'
  if (input.receiptFailures > 0 || input.lastSweepStatus === 'partial') return 'yellow'
  if (input.lastSweepStatus === 'ok') return 'green'
  return 'gray'
}

function normalizeProfileEmail(profile: DocumentRow['user_profile']): string | null {
  if (!profile) return null
  if (Array.isArray(profile)) return profile[0]?.email ?? null
  return profile.email
}

export function documentDeletionScrubPayload(deletedAt: string): Record<string, unknown> {
  return {
    deleted_at: deletedAt,
    status: 'expired',
    file_sha256: null,
    duplicate_of_document_id: null,
    duplicate_checked_at: null,
    duplicate_fingerprint: null,
  }
}

export function statementDeletionScrubPayload(deletedAt: string): Record<string, unknown> {
  return {
    deleted_at: deletedAt,
    transactions: [],
  }
}

function getDeletionStoreClient(): ServiceRoleLike {
  return getServiceRoleClient() as unknown as ServiceRoleLike
}
