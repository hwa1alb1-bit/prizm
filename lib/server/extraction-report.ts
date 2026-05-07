import 'server-only'

import { recordAuditEvent } from './audit'
import { getServiceRoleClient } from './supabase'
import type { Json } from '../shared/db-types'
import type { RouteContext } from './http'

export type ExtractionReportInput = {
  documentId: string
  actorUserId: string
  category: string
  note: string | null
  row: ExtractionReportRowContext | null
  actorIp: string | null
  actorUserAgent: string | null
  routeContext: RouteContext
  store?: ExtractionReportStore
}

export type ExtractionReportRowContext = {
  id?: string
  index?: number
  source?: string
}

export type ExtractionReportResult =
  | {
      ok: true
      reportId: string
      documentId: string
      statementId: string | null
      requestId: string
      traceId: string
    }
  | ExtractionReportProblem

export type ExtractionReportProblem = {
  ok: false
  status: number
  code: string
  title: string
  detail: string
}

export type ExtractionReportStore = {
  getWorkspaceIdForUser: (userId: string) => Promise<string | null>
  getDocument: (workspaceId: string, documentId: string) => Promise<{ id: string } | null>
  getStatement: (workspaceId: string, documentId: string) => Promise<{ id: string } | null>
  recordReport: (input: {
    workspaceId: string
    actorUserId: string
    documentId: string
    statementId: string | null
    category: string
    note: string | null
    row: ExtractionReportRowContext | null
    actorIp: string | null
    actorUserAgent: string | null
    routeContext: RouteContext
  }) => Promise<string | null>
}

type QueryResult<T> = { data: T | null; error: { message: string } | null }
type QueryBuilder<T> = {
  eq: (column: string, value: unknown) => QueryBuilder<T>
  order: (column: string, options: { ascending: boolean }) => QueryBuilder<T>
  limit: (count: number) => Promise<QueryResult<T[]>>
}
type StoreClient = {
  from: (table: string) => {
    select: <T>(columns: string) => QueryBuilder<T>
  }
}

export async function createExtractionReport(
  input: ExtractionReportInput,
): Promise<ExtractionReportResult> {
  const store = input.store ?? createExtractionReportStore()
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

  const statement = await store.getStatement(workspaceId, input.documentId)
  const reportId = await store.recordReport({
    workspaceId,
    actorUserId: input.actorUserId,
    documentId: input.documentId,
    statementId: statement?.id ?? null,
    category: input.category,
    note: input.note,
    row: input.row,
    actorIp: input.actorIp,
    actorUserAgent: input.actorUserAgent,
    routeContext: input.routeContext,
  })

  if (!reportId) {
    return problem(
      500,
      'PRZM_EXTRACTION_REPORT_WRITE_FAILED',
      'Extraction report could not be recorded',
      'The extraction report and audit evidence could not be recorded.',
    )
  }

  return {
    ok: true,
    reportId,
    documentId: input.documentId,
    statementId: statement?.id ?? null,
    requestId: input.routeContext.requestId,
    traceId: input.routeContext.traceId,
  }
}

function problem(
  status: number,
  code: string,
  title: string,
  detail: string,
): ExtractionReportProblem {
  return { ok: false, status, code, title, detail }
}

function createExtractionReportStore(): ExtractionReportStore {
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
        .select<{ id: string }>('id')
        .eq('workspace_id', workspaceId)
        .eq('id', documentId)
        .limit(1)
      if (error) throw new Error('document_lookup_failed')
      return data?.[0] ?? null
    },
    async getStatement(workspaceId, documentId) {
      const { data, error } = await client
        .from('statement')
        .select<{ id: string }>('id')
        .eq('workspace_id', workspaceId)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw new Error('statement_lookup_failed')
      return data?.[0] ?? null
    },
    async recordReport(input) {
      const result = await recordAuditEvent({
        eventType: 'extraction_report.created',
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        actorIp: input.actorIp,
        actorUserAgent: input.actorUserAgent,
        targetType: 'document',
        targetId: input.documentId,
        metadata: {
          document_id: input.documentId,
          statement_id: input.statementId,
          category: input.category,
          note: input.note,
          row: input.row as Json,
          request_id: input.routeContext.requestId,
          trace_id: input.routeContext.traceId,
        },
      })
      return result.ok ? (result.id ?? null) : null
    },
  }
}
