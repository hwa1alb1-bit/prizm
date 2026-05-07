import 'server-only'

import { recordAuditEvent } from './audit'
import { getServiceRoleClient } from './supabase'
import type { Json } from '../shared/db-types'
import type { RouteContext } from './http'

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

export type ApplyStatementEditInput = {
  documentId: string
  actorUserId: string
  expectedRevision: number
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
      reviewStatus: 'needs_review' | 'reviewed'
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

export type StatementEditStore = {
  getWorkspaceIdForUser: (userId: string) => Promise<string | null>
  getDocument: (workspaceId: string, documentId: string) => Promise<EditableDocumentRow | null>
  getStatement: (workspaceId: string, documentId: string) => Promise<EditableStatementRow | null>
  updateStatement: (
    statementId: string,
    patch: {
      transactions: Json[]
      revision: number
      review_status: 'needs_review' | 'reviewed'
      edited_by: string
      edited_at: string
    },
  ) => Promise<boolean>
  recordAudit: (input: {
    workspaceId: string
    actorUserId: string
    statementId: string
    documentId: string
    operationCount: number
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
  transactions: Json
  revision?: number | null
  review_status?: string | null
  expires_at: string
  deleted_at: string | null
}

type QueryResult<T> = { data: T | null; error: { message: string } | null }

type QueryBuilder<T> = {
  eq: (column: string, value: unknown) => QueryBuilder<T>
  order: (column: string, options: { ascending: boolean }) => QueryBuilder<T>
  limit: (count: number) => Promise<QueryResult<T[]>>
  single: () => Promise<QueryResult<T>>
}

type MutationBuilder<T> = {
  eq: (column: string, value: unknown) => MutationBuilder<T>
  select: (columns: string) => MutationBuilder<T>
  single: () => Promise<QueryResult<T>>
}

type StoreClient = {
  from: (table: string) => {
    select: <T>(columns: string) => QueryBuilder<T>
    update: <T>(patch: Record<string, unknown>) => MutationBuilder<T>
  }
}

export async function applyStatementEdit(
  input: ApplyStatementEditInput,
): Promise<StatementEditResult> {
  const store = input.store ?? createStatementEditStore()
  const workspaceId = await store.getWorkspaceIdForUser(input.actorUserId)
  if (!workspaceId)
    return problem(
      403,
      'PRZM_AUTH_WORKSPACE_REQUIRED',
      'Workspace access required',
      'The signed-in user is not attached to a workspace.',
    )

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
  const nextRevision = currentRevision + 1
  const reviewStatus = input.reviewed ? 'reviewed' : 'needs_review'
  const updated = await store.updateStatement(statement.id, {
    transactions: nextTransactions,
    revision: nextRevision,
    review_status: reviewStatus,
    edited_by: input.actorUserId,
    edited_at: new Date().toISOString(),
  })

  if (!updated)
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
    operationCount: input.operations.length,
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
  let next = [...transactions]

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
    async getWorkspaceIdForUser(userId) {
      const { data, error } = await client
        .from('user_profile')
        .select<{ workspace_id: string }>('workspace_id')
        .eq('id', userId)
        .limit(1)
      if (error) throw new Error('workspace_lookup_failed')
      return data?.[0]?.workspace_id ?? null
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
          'id, transactions, revision, review_status, expires_at, deleted_at',
        )
        .eq('workspace_id', workspaceId)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw new Error('statement_lookup_failed')
      return data?.[0] ?? null
    },
    async updateStatement(statementId, patch) {
      const { data, error } = await client
        .from('statement')
        .update<{ id: string }>(patch)
        .eq('id', statementId)
        .select('id')
        .single()
      return !error && Boolean(data)
    },
    async recordAudit(input) {
      const result = await recordAuditEvent({
        eventType: 'statement.edited',
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        actorIp: input.actorIp,
        actorUserAgent: input.actorUserAgent,
        targetType: 'statement',
        targetId: input.statementId,
        metadata: {
          document_id: input.documentId,
          operation_count: input.operationCount,
          revision: input.revision,
          request_id: input.routeContext.requestId,
          trace_id: input.routeContext.traceId,
        },
      })
      return result.ok
    },
  }
}
