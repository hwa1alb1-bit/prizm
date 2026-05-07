import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import ExcelJS from 'exceljs'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { recordAuditEvent } from './audit'
import { getS3Client, getKmsKeyId, getUploadBucket } from './s3'
import { getServiceRoleClient } from './supabase'
import type { Json } from '../shared/db-types'
import type { RouteContext } from './http'

export const STATEMENT_EXPORT_FORMATS = ['csv', 'xlsx', 'quickbooks_csv', 'xero_csv'] as const

export type StatementExportFormat = (typeof STATEMENT_EXPORT_FORMATS)[number]

export type BuildStatementExportInput = {
  documentId: string
  format: StatementExportFormat
  actorUserId: string
  actorIp: string | null
  actorUserAgent: string | null
  routeContext: RouteContext
  store?: StatementExportStore
}

export type CreateStatementExportArtifactInput = {
  documentId: string
  format: 'csv'
  actorUserId: string
  actorIp: string | null
  actorUserAgent: string | null
  routeContext: RouteContext
  idFactory?: () => string
  store?: StatementExportArtifactStore
  objectStore?: StatementExportObjectStore
}

export type GetStatementExportDownloadInput = {
  exportId: string
  actorUserId: string
  actorIp: string | null
  actorUserAgent: string | null
  routeContext: RouteContext
  store?: StatementExportDownloadStore
  objectStore?: StatementExportObjectStore
}

export type StatementExportResult =
  | {
      ok: true
      body: string | Uint8Array
      contentType: string
      filename: string
      requestId: string
      traceId: string
    }
  | StatementExportProblem

export type CreateStatementExportArtifactResult =
  | {
      ok: true
      exportId: string
      documentId: string
      format: 'csv'
      filename: string
      contentType: string
      expiresAt: string
      requestId: string
      traceId: string
    }
  | StatementExportProblem

export type StatementExportDownloadResult =
  | {
      ok: true
      exportId: string
      downloadUrl: string
      expiresInSeconds: number
      requestId: string
      traceId: string
    }
  | StatementExportProblem

export type StatementExportProblem = {
  ok: false
  status: number
  code: string
  title: string
  detail: string
}

export type StatementExportStore = {
  getWorkspaceIdForUser: (userId: string) => Promise<string | null>
  getDocument: (workspaceId: string, documentId: string) => Promise<ExportDocumentRow | null>
  getStatement: (workspaceId: string, documentId: string) => Promise<ExportStatementRow | null>
  recordAudit: (input: {
    workspaceId: string
    actorUserId: string
    statementId: string
    documentId: string
    format: StatementExportFormat
    actorIp: string | null
    actorUserAgent: string | null
    routeContext: RouteContext
  }) => Promise<boolean>
}

export type StatementExportArtifactStore = {
  getWorkspaceIdForUser: (userId: string) => Promise<string | null>
  getDocument: (workspaceId: string, documentId: string) => Promise<ExportDocumentRow | null>
  getStatement: (workspaceId: string, documentId: string) => Promise<ExportStatementRow | null>
  createArtifact: (input: {
    id: string
    workspaceId: string
    documentId: string
    statementId: string
    format: 'csv'
    filename: string
    s3Bucket: string
    s3Key: string
    contentType: string
    expiresAt: string
    byteSize: number
    checksumSha256: string
    actorUserId: string
    requestId: string
    traceId: string
  }) => Promise<{ id: string }>
  recordAudit: (input: {
    eventType: 'export.generated'
    workspaceId: string
    actorUserId: string
    documentId: string
    statementId: string
    exportId: string
    format: 'csv'
    filename: string
    byteSize: number
    checksumSha256: string
    actorIp: string | null
    actorUserAgent: string | null
    routeContext: RouteContext
  }) => Promise<boolean>
}

export type ExportArtifactRow = {
  id: string
  workspace_id: string
  document_id: string
  statement_id: string
  format: string
  filename: string | null
  s3_bucket: string | null
  s3_key: string | null
  content_type: string | null
  expires_at: string | null
  deleted_at: string | null
}

export type StatementExportDownloadStore = {
  getWorkspaceIdForUser: (userId: string) => Promise<string | null>
  getArtifact: (workspaceId: string, exportId: string) => Promise<ExportArtifactRow | null>
  recordAudit: (input: {
    eventType: 'export.downloaded'
    workspaceId: string
    actorUserId: string
    documentId: string
    statementId: string
    exportId: string
    format: string
    filename: string
    actorIp: string | null
    actorUserAgent: string | null
    routeContext: RouteContext
  }) => Promise<boolean>
}

export type StatementExportObjectStore = {
  getExportBucket: () => string
  putObject: (input: {
    bucket: string
    key: string
    body: string
    contentType: string
  }) => Promise<void>
  getSignedDownloadUrl: (input: {
    bucket: string
    key: string
    filename: string
    contentType: string
    expiresInSeconds: number
  }) => Promise<string>
}

export type ExportDocumentRow = {
  id: string
  status: string
  expires_at: string
  deleted_at: string | null
  filename: string
}

export type ExportStatementRow = {
  id: string
  statement_type?: string | null
  review_status?: string | null
  reconciles: boolean | null
  transactions: Json
  expires_at: string
  deleted_at: string | null
}

type ExportRow = {
  date: string
  description: string
  amount: string
  debit: string
  credit: string
  balance: string
  payee: string
  reference: string
  needsReview: boolean
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

export async function buildStatementExport(
  input: BuildStatementExportInput,
): Promise<StatementExportResult> {
  const store = input.store ?? createStatementExportStore()
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
      'PRZM_EXPORT_NOT_READY',
      'Export not ready',
      'Only ready documents can be exported.',
    )
  if (isExpired(document.expires_at) || document.deleted_at)
    return problem(
      410,
      'PRZM_EXPORT_EXPIRED',
      'Export expired',
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
      'PRZM_EXPORT_EXPIRED',
      'Export expired',
      'This statement is outside the active retention window.',
    )
  if (statement.review_status !== 'reviewed')
    return problem(
      409,
      'PRZM_EXPORT_REVIEW_REQUIRED',
      'Review required',
      'Review this statement before exporting ledger output.',
    )
  if (statement.reconciles !== true)
    return problem(
      409,
      'PRZM_EXPORT_RECONCILIATION_REQUIRED',
      'Reconciliation required',
      'Resolve reconciliation before exporting ledger output.',
    )

  const rows = exportRows(statement.transactions, statement.statement_type)
  const invalidRows = rows.filter(rowIsInvalid)
  if (invalidRows.length > 0) {
    return problem(
      409,
      'PRZM_EXPORT_INVALID_ROWS',
      'Invalid rows block export',
      `${invalidRows.length} transaction row must be corrected before export.`,
    )
  }

  const body = input.format === 'xlsx' ? await xlsxFor(rows) : csvFor(input.format, rows)
  const audited = await store.recordAudit({
    workspaceId,
    actorUserId: input.actorUserId,
    statementId: statement.id,
    documentId: input.documentId,
    format: input.format,
    actorIp: input.actorIp,
    actorUserAgent: input.actorUserAgent,
    routeContext: input.routeContext,
  })
  if (!audited)
    return problem(
      500,
      'PRZM_EXPORT_AUDIT_FAILED',
      'Export audit failed',
      'The export could not be audited.',
    )

  return {
    ok: true,
    body,
    contentType:
      input.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8',
    filename: exportFilename(document.filename, input.format),
    requestId: input.routeContext.requestId,
    traceId: input.routeContext.traceId,
  }
}

export async function createStatementExportArtifact(
  input: CreateStatementExportArtifactInput,
): Promise<CreateStatementExportArtifactResult> {
  const store = input.store ?? createStatementExportArtifactStore()
  const objectStore = input.objectStore ?? createStatementExportObjectStore()
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
      'PRZM_EXPORT_NOT_READY',
      'Export not ready',
      'Only ready documents can be exported.',
    )
  if (isExpired(document.expires_at) || document.deleted_at)
    return problem(
      410,
      'PRZM_EXPORT_EXPIRED',
      'Export expired',
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
      'PRZM_EXPORT_EXPIRED',
      'Export expired',
      'This statement is outside the active retention window.',
    )
  if (statement.review_status !== 'reviewed')
    return problem(
      409,
      'PRZM_EXPORT_REVIEW_REQUIRED',
      'Review required',
      'Review this statement before exporting ledger output.',
    )
  if (statement.reconciles !== true)
    return problem(
      409,
      'PRZM_EXPORT_RECONCILIATION_REQUIRED',
      'Reconciliation required',
      'Resolve reconciliation before exporting ledger output.',
    )

  const rows = exportRows(statement.transactions, statement.statement_type)
  const invalidRows = rows.filter(rowIsInvalid)
  if (invalidRows.length > 0) {
    return problem(
      409,
      'PRZM_EXPORT_INVALID_ROWS',
      'Invalid rows block export',
      `${invalidRows.length} transaction row must be corrected before export.`,
    )
  }

  const body = csvFor(input.format, rows)
  const exportId = input.idFactory?.() ?? randomUUID()
  const filename = exportFilename(document.filename, input.format)
  const contentType = 'text/csv; charset=utf-8'
  const bucket = objectStore.getExportBucket()
  const key = `${workspaceId}/exports/${document.id}/${exportId}.csv`
  const byteSize = new TextEncoder().encode(body).byteLength
  const checksumSha256 = createHash('sha256').update(body).digest('hex')
  const expiresAt = earlierIso(document.expires_at, statement.expires_at)

  try {
    await objectStore.putObject({
      bucket,
      key,
      body,
      contentType,
    })
  } catch {
    return problem(
      500,
      'PRZM_EXPORT_ARTIFACT_WRITE_FAILED',
      'Export artifact write failed',
      'The CSV export artifact could not be written.',
    )
  }

  let artifact: { id: string }
  try {
    artifact = await store.createArtifact({
      id: exportId,
      workspaceId,
      documentId: document.id,
      statementId: statement.id,
      format: input.format,
      filename,
      s3Bucket: bucket,
      s3Key: key,
      contentType,
      expiresAt,
      byteSize,
      checksumSha256,
      actorUserId: input.actorUserId,
      requestId: input.routeContext.requestId,
      traceId: input.routeContext.traceId,
    })
  } catch {
    return problem(
      500,
      'PRZM_EXPORT_ARTIFACT_RECORD_FAILED',
      'Export artifact record failed',
      'The CSV export artifact could not be recorded.',
    )
  }

  const audited = await store.recordAudit({
    eventType: 'export.generated',
    workspaceId,
    actorUserId: input.actorUserId,
    documentId: document.id,
    statementId: statement.id,
    exportId: artifact.id,
    format: input.format,
    filename,
    byteSize,
    checksumSha256,
    actorIp: input.actorIp,
    actorUserAgent: input.actorUserAgent,
    routeContext: input.routeContext,
  })
  if (!audited)
    return problem(
      500,
      'PRZM_EXPORT_AUDIT_FAILED',
      'Export audit failed',
      'The export could not be audited.',
    )

  return {
    ok: true,
    exportId: artifact.id,
    documentId: document.id,
    format: input.format,
    filename,
    contentType,
    expiresAt,
    requestId: input.routeContext.requestId,
    traceId: input.routeContext.traceId,
  }
}

export async function getStatementExportDownload(
  input: GetStatementExportDownloadInput,
): Promise<StatementExportDownloadResult> {
  const store = input.store ?? createStatementExportDownloadStore()
  const objectStore = input.objectStore ?? createStatementExportObjectStore()
  const workspaceId = await store.getWorkspaceIdForUser(input.actorUserId)
  if (!workspaceId)
    return problem(
      403,
      'PRZM_AUTH_WORKSPACE_REQUIRED',
      'Workspace access required',
      'The signed-in user is not attached to a workspace.',
    )

  const artifact = await store.getArtifact(workspaceId, input.exportId)
  if (!artifact)
    return problem(
      404,
      'PRZM_EXPORT_NOT_FOUND',
      'Export not found',
      'This export is not available in the current workspace.',
    )
  if (!artifact.expires_at || artifact.deleted_at || isExpired(artifact.expires_at))
    return problem(
      410,
      'PRZM_EXPORT_EXPIRED',
      'Export expired',
      'This export is outside the active retention window.',
    )
  if (!artifact.s3_bucket || !artifact.s3_key || !artifact.filename || !artifact.content_type)
    return problem(
      409,
      'PRZM_EXPORT_ARTIFACT_UNAVAILABLE',
      'Export artifact unavailable',
      'This export artifact does not have downloadable storage evidence.',
    )

  const expiresInSeconds = 300
  let downloadUrl: string
  try {
    downloadUrl = await objectStore.getSignedDownloadUrl({
      bucket: artifact.s3_bucket,
      key: artifact.s3_key,
      filename: artifact.filename,
      contentType: artifact.content_type,
      expiresInSeconds,
    })
  } catch {
    return problem(
      500,
      'PRZM_EXPORT_DOWNLOAD_SIGN_FAILED',
      'Export download could not be prepared',
      'The export download URL could not be created.',
    )
  }

  const audited = await store.recordAudit({
    eventType: 'export.downloaded',
    workspaceId,
    actorUserId: input.actorUserId,
    documentId: artifact.document_id,
    statementId: artifact.statement_id,
    exportId: artifact.id,
    format: artifact.format,
    filename: artifact.filename,
    actorIp: input.actorIp,
    actorUserAgent: input.actorUserAgent,
    routeContext: input.routeContext,
  })
  if (!audited)
    return problem(
      500,
      'PRZM_EXPORT_AUDIT_FAILED',
      'Export audit failed',
      'The export download could not be audited.',
    )

  return {
    ok: true,
    exportId: artifact.id,
    downloadUrl,
    expiresInSeconds,
    requestId: input.routeContext.requestId,
    traceId: input.routeContext.traceId,
  }
}

async function xlsxFor(rows: ExportRow[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PRIZM'
  workbook.created = new Date()
  const worksheet = workbook.addWorksheet('Statement')
  worksheet.addRow(['Date', 'Description', 'Debit', 'Credit', 'Amount', 'Balance'])
  for (const row of rows) {
    worksheet.addRow([row.date, row.description, row.debit, row.credit, row.amount, row.balance])
  }
  worksheet.columns = [
    { key: 'date', width: 14 },
    { key: 'description', width: 40 },
    { key: 'debit', width: 12 },
    { key: 'credit', width: 12 },
    { key: 'amount', width: 12 },
    { key: 'balance', width: 12 },
  ]
  worksheet.getRow(1).font = { bold: true }
  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}

function csvFor(format: Exclude<StatementExportFormat, 'xlsx'>, rows: ExportRow[]): string {
  switch (format) {
    case 'csv':
      return csv([
        ['Date', 'Description', 'Debit', 'Credit', 'Amount', 'Balance'],
        ...rows.map((row) => [
          row.date,
          row.description,
          row.debit,
          row.credit,
          row.amount,
          row.balance,
        ]),
      ])
    case 'quickbooks_csv':
      return csv([
        ['Date', 'Description', 'Amount'],
        ...rows.map((row) => [row.date, row.description, row.amount]),
      ])
    case 'xero_csv':
      return csv([
        ['Date', 'Amount', 'Payee', 'Description', 'Reference'],
        ...rows.map((row) => [row.date, row.amount, row.payee, row.description, row.reference]),
      ])
  }
}

function csv(rows: string[][]): string {
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

function csvCell(value: string): string {
  if (!/[",\r\n]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

function exportRows(value: Json, statementType: string | null | undefined): ExportRow[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => exportRow(row, statementType === 'credit_card'))
}

function exportRow(value: Json, isCreditCard: boolean): ExportRow {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const amount = stringValue(row, ['amount'])
  const debit = stringValue(row, ['debit', 'withdrawal', 'outflow'])
  const credit = stringValue(row, ['credit', 'deposit', 'inflow'])
  const description = stringValue(row, ['description', 'memo', 'details', 'name'])
  const payee = stringValue(row, ['payee', 'merchant', 'name'])
  return {
    date: stringValue(row, ['posted_at', 'postedAt', 'date', 'transaction_date']),
    description,
    amount: isCreditCard
      ? signedAmount(debit, credit) || amount
      : amount || signedAmount(debit, credit),
    debit,
    credit,
    balance: stringValue(row, ['balance', 'running_balance']),
    payee: isCreditCard ? payee || description : payee,
    reference: stringValue(row, ['reference', 'id', 'transaction_id']),
    needsReview: booleanValue(row, ['needs_review', 'needsReview', 'flagged']),
  }
}

function rowIsInvalid(row: ExportRow): boolean {
  return row.needsReview || !row.date || !row.description || !row.amount
}

function stringValue(row: Record<string, Json | undefined>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function booleanValue(row: Record<string, Json | undefined>, keys: readonly string[]): boolean {
  for (const key of keys) {
    if (typeof row[key] === 'boolean') return row[key]
  }
  return false
}

function signedAmount(debit: string, credit: string): string {
  if (credit) return credit
  if (!debit) return ''
  const numeric = Number(debit)
  return Number.isFinite(numeric) ? String(-Math.abs(numeric)) : `-${debit}`
}

function exportFilename(filename: string, format: StatementExportFormat): string {
  const stem = filename.replace(/\.[^.]+$/, '') || 'statement'
  const suffix = format === 'csv' ? 'csv' : format.replace('_', '-')
  return `${stem}.${suffix}`
}

function earlierIso(first: string, second: string): string {
  return new Date(Math.min(new Date(first).getTime(), new Date(second).getTime())).toISOString()
}

function isExpired(value: string): boolean {
  return new Date(value).getTime() <= Date.now()
}

function problem(
  status: number,
  code: string,
  title: string,
  detail: string,
): StatementExportProblem {
  return { ok: false, status, code, title, detail }
}

function createStatementExportStore(): StatementExportStore {
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
        .select<ExportDocumentRow>('id, status, expires_at, deleted_at, filename')
        .eq('workspace_id', workspaceId)
        .eq('id', documentId)
        .limit(1)
      if (error) throw new Error('document_lookup_failed')
      return data?.[0] ?? null
    },
    async getStatement(workspaceId, documentId) {
      const { data, error } = await client
        .from('statement')
        .select<ExportStatementRow>(
          'id, statement_type, review_status, reconciles, transactions, expires_at, deleted_at',
        )
        .eq('workspace_id', workspaceId)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw new Error('statement_lookup_failed')
      return data?.[0] ?? null
    },
    async recordAudit(input) {
      const result = await recordAuditEvent({
        eventType: 'statement.export_generated',
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        actorIp: input.actorIp,
        actorUserAgent: input.actorUserAgent,
        targetType: 'statement',
        targetId: input.statementId,
        metadata: {
          document_id: input.documentId,
          format: input.format,
          request_id: input.routeContext.requestId,
          trace_id: input.routeContext.traceId,
        },
      })
      return result.ok
    },
  }
}

function createStatementExportArtifactStore(): StatementExportArtifactStore {
  const client = getServiceRoleClient() as unknown as ArtifactStoreClient
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
        .select<ExportDocumentRow>('id, status, expires_at, deleted_at, filename')
        .eq('workspace_id', workspaceId)
        .eq('id', documentId)
        .limit(1)
      if (error) throw new Error('document_lookup_failed')
      return data?.[0] ?? null
    },
    async getStatement(workspaceId, documentId) {
      const { data, error } = await client
        .from('statement')
        .select<ExportStatementRow>(
          'id, statement_type, review_status, reconciles, transactions, expires_at, deleted_at',
        )
        .eq('workspace_id', workspaceId)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw new Error('statement_lookup_failed')
      return data?.[0] ?? null
    },
    async createArtifact(input) {
      const { data, error } = await client
        .from('export_artifact')
        .insert({
          id: input.id,
          workspace_id: input.workspaceId,
          document_id: input.documentId,
          statement_id: input.statementId,
          format: input.format,
          filename: input.filename,
          s3_bucket: input.s3Bucket,
          s3_key: input.s3Key,
          content_type: input.contentType,
          expires_at: input.expiresAt,
          byte_size: input.byteSize,
          checksum_sha256: input.checksumSha256,
          created_by: input.actorUserId,
          request_id: input.requestId,
          trace_id: input.traceId,
        })
        .select('id')
        .single<{ id: string }>()

      if (error || !data) throw new Error('export_artifact_write_failed')
      return { id: data.id }
    },
    async recordAudit(input) {
      const result = await recordAuditEvent({
        eventType: input.eventType,
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        actorIp: input.actorIp,
        actorUserAgent: input.actorUserAgent,
        targetType: 'export_artifact',
        targetId: input.exportId,
        metadata: {
          document_id: input.documentId,
          statement_id: input.statementId,
          format: input.format,
          filename: input.filename,
          byte_size: input.byteSize,
          checksum_sha256: input.checksumSha256,
          request_id: input.routeContext.requestId,
          trace_id: input.routeContext.traceId,
        },
      })
      return result.ok
    },
  }
}

function createStatementExportDownloadStore(): StatementExportDownloadStore {
  const client = getServiceRoleClient() as unknown as ArtifactStoreClient
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
    async getArtifact(workspaceId, exportId) {
      const { data, error } = await client
        .from('export_artifact')
        .select<ExportArtifactRow>(
          [
            'id',
            'workspace_id',
            'document_id',
            'statement_id',
            'format',
            'filename',
            's3_bucket',
            's3_key',
            'content_type',
            'expires_at',
            'deleted_at',
          ].join(', '),
        )
        .eq('workspace_id', workspaceId)
        .eq('id', exportId)
        .limit(1)
      if (error) throw new Error('export_artifact_lookup_failed')
      return data?.[0] ?? null
    },
    async recordAudit(input) {
      const result = await recordAuditEvent({
        eventType: input.eventType,
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        actorIp: input.actorIp,
        actorUserAgent: input.actorUserAgent,
        targetType: 'export_artifact',
        targetId: input.exportId,
        metadata: {
          document_id: input.documentId,
          statement_id: input.statementId,
          format: input.format,
          filename: input.filename,
          request_id: input.routeContext.requestId,
          trace_id: input.routeContext.traceId,
        },
      })
      return result.ok
    },
  }
}

type ArtifactInsertBuilder = {
  select: (columns: string) => {
    single: <R>() => Promise<QueryResult<R>>
  }
}

type ArtifactStoreClient = {
  from: (table: string) => {
    select: <T>(columns: string) => QueryBuilder<T>
    insert: <T>(payload: T) => ArtifactInsertBuilder
  }
}

function createStatementExportObjectStore(): StatementExportObjectStore {
  return {
    getExportBucket: getUploadBucket,
    async putObject(input) {
      const kmsKeyId = getKmsKeyId()
      await getS3Client().send(
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          ServerSideEncryption: 'aws:kms',
          ...(kmsKeyId ? { SSEKMSKeyId: kmsKeyId } : {}),
        }),
      )
    },
    async getSignedDownloadUrl(input) {
      return getSignedUrl(
        getS3Client(),
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          ResponseContentType: input.contentType,
          ResponseContentDisposition: `attachment; filename="${input.filename.replaceAll('"', '')}"`,
        }),
        { expiresIn: input.expiresInSeconds },
      )
    },
  }
}
