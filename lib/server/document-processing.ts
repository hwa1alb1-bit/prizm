import 'server-only'

import type { Json } from '../shared/db-types'
import { recordAuditEventOrThrow, type AuditEventInput } from './audit'
import {
  consumeDocumentConversionCredit,
  releaseDocumentConversionCredit,
} from './credit-reservation'
import { createExtractionEngineByName, type ExtractionPollResult } from './extraction-engine'
import type { RouteContext } from './http'
import { type ParsedStatement } from './statement-parser'
import { getServiceRoleClient } from './supabase'

export type ProcessingDocument = {
  id: string
  workspaceId: string
  extractionEngine: string | null
  extractionJobId: string | null
  textractJobId: string | null
}

export type ProcessExtractionDocumentsInput = {
  now?: Date
  limit?: number
  documentId?: string
  trigger: 'cron' | 'manual' | 'status' | 'test'
  routeContext?: RouteContext
}

export type ProcessTextractDocumentsInput = ProcessExtractionDocumentsInput

export type ProcessExtractionDocumentsResult = {
  status: 'ok' | 'partial' | 'failed'
  polled: number
  ready: number
  failed: number
  skipped: number
}

export type ProcessTextractDocumentsResult = ProcessExtractionDocumentsResult

export type DocumentProcessingDependencies = {
  listProcessingDocuments: (input: {
    limit: number
    documentId?: string
  }) => Promise<ProcessingDocument[]>
  pollExtraction: (input: { engine: string; jobId: string }) => Promise<ExtractionPollResult>
  storeParsedStatement: (input: {
    documentId: string
    workspaceId: string
    expiresAt: string
    statement: ParsedStatement
  }) => Promise<void>
  markDocumentReady: (input: { documentId: string; convertedAt: string }) => Promise<void>
  markDocumentFailed: (input: { documentId: string; failureReason: string }) => Promise<void>
  consumeCreditReservation: (input: { documentId: string; consumedAt: string }) => Promise<void>
  releaseCreditReservation: (input: { documentId: string; releasedAt: string }) => Promise<void>
  recordAuditEvent: (input: AuditEventInput) => Promise<void>
}

type ProcessingDocumentRow = {
  id: string
  workspace_id: string
  extraction_engine: string | null
  extraction_job_id: string | null
  textract_job_id: string | null
}

type QueryResult<T> = {
  data: T | null
  error: { message: string } | null
}

type SelectBuilder<T> = {
  eq: (column: string, value: string) => SelectBuilder<T>
  is: (column: string, value: null) => SelectBuilder<T>
  limit: (count: number) => Promise<QueryResult<T[]>>
}

type UpdateBuilder = {
  eq: (column: string, value: string) => UpdateBuilder
  in: (column: string, values: string[]) => UpdateBuilder
  select: (columns: string) => {
    maybeSingle: () => Promise<QueryResult<{ id: string }>>
  }
}

type TableBuilder = {
  select: <T>(columns: string) => SelectBuilder<T>
  update: (payload: Record<string, unknown>) => UpdateBuilder
  insert: (payload: Record<string, unknown>) => Promise<QueryResult<unknown>>
}

type ProcessingStoreClient = {
  from: (table: string) => TableBuilder
}

type StatementType = 'bank' | 'credit_card'
type StatementMetadata = ParsedStatement['metadata']
type StatementPersistenceFields = {
  statementType: StatementType
  metadata: StatementMetadata
}

export async function processExtractionDocuments(
  input: ProcessExtractionDocumentsInput,
  deps: DocumentProcessingDependencies = createDocumentProcessingDependencies(),
): Promise<ProcessExtractionDocumentsResult> {
  const now = input.now ?? new Date()
  const nowIso = now.toISOString()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const limit = input.limit ?? 25
  const documents = await deps.listProcessingDocuments(
    input.documentId ? { limit, documentId: input.documentId } : { limit },
  )
  let ready = 0
  let failed = 0
  let skipped = 0

  for (const document of documents) {
    const identity = extractionIdentity(document)

    if (!identity) {
      await failProcessingDocument({
        deps,
        document,
        failureReason: 'Processing document is missing an extraction job id.',
        releasedAt: nowIso,
        input,
      })
      failed += 1
      continue
    }

    const extraction = await deps.pollExtraction(identity)

    if (extraction.status === 'in_progress') {
      skipped += 1
      continue
    }

    if (extraction.status === 'failed') {
      await failProcessingDocument({
        deps,
        document,
        failureReason: extraction.failureReason,
        releasedAt: nowIso,
        input,
      })
      failed += 1
      continue
    }

    if (!hasUsableStatements(extraction.statements)) {
      await failProcessingDocument({
        deps,
        document,
        failureReason: 'Extraction output did not include a usable statement.',
        releasedAt: nowIso,
        input,
      })
      failed += 1
      continue
    }

    for (const statement of extraction.statements) {
      await deps.storeParsedStatement({
        documentId: document.id,
        workspaceId: document.workspaceId,
        expiresAt,
        statement: statementWithPersistenceDefaults(statement),
      })
    }

    await deps.consumeCreditReservation({ documentId: document.id, consumedAt: nowIso })
    await deps.markDocumentReady({ documentId: document.id, convertedAt: nowIso })
    await deps.recordAuditEvent({
      eventType: 'document.processing_ready',
      workspaceId: document.workspaceId,
      actorUserId: null,
      targetType: 'document',
      targetId: document.id,
      metadata: auditMetadata(input, document, {
        statement_count: extraction.statements.length,
      }),
    })
    ready += 1
  }

  return {
    status: failed === 0 ? 'ok' : ready > 0 || skipped > 0 ? 'partial' : 'failed',
    polled: documents.length,
    ready,
    failed,
    skipped,
  }
}

export async function processTextractDocuments(
  input: ProcessTextractDocumentsInput,
  deps: DocumentProcessingDependencies = createDocumentProcessingDependencies(),
): Promise<ProcessTextractDocumentsResult> {
  return processExtractionDocuments(input, deps)
}

function createDocumentProcessingDependencies(): DocumentProcessingDependencies {
  return {
    listProcessingDocuments,
    pollExtraction,
    storeParsedStatement,
    markDocumentReady,
    markDocumentFailed,
    consumeCreditReservation,
    releaseCreditReservation,
    recordAuditEvent: async (input) => {
      await recordAuditEventOrThrow(input)
    },
  }
}

async function listProcessingDocuments(input: {
  limit: number
  documentId?: string
}): Promise<ProcessingDocument[]> {
  let query = getProcessingStoreClient()
    .from('document')
    .select<ProcessingDocumentRow>(
      'id, workspace_id, extraction_engine, extraction_job_id, textract_job_id',
    )
    .eq('status', 'processing')
    .is('deleted_at', null)

  if (input.documentId) query = query.eq('id', input.documentId)

  const { data, error } = await query.limit(input.limit)

  if (error) throw new Error('processing_document_read_failed')

  return (data ?? []).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    extractionEngine: row.extraction_engine,
    extractionJobId: row.extraction_job_id,
    textractJobId: row.textract_job_id,
  }))
}

async function pollExtraction(input: {
  engine: string
  jobId: string
}): Promise<ExtractionPollResult> {
  const engine = createExtractionEngineByName(input.engine)

  if (!engine) {
    return {
      status: 'failed',
      engine: input.engine,
      jobId: input.jobId,
      failureReason: `Extraction engine ${input.engine} is not supported by this deployment.`,
    }
  }

  try {
    return await engine.poll({ jobId: input.jobId })
  } catch (err) {
    if (input.engine === 'kotlin_worker') {
      return {
        status: 'failed',
        engine: input.engine,
        jobId: input.jobId,
        failureReason: 'Kotlin worker could not be polled by this deployment.',
      }
    }

    throw err
  }
}

function extractionIdentity(document: ProcessingDocument): {
  engine: string
  jobId: string
} | null {
  const jobId = document.extractionJobId ?? document.textractJobId
  const engine = document.extractionEngine ?? (jobId ? 'textract' : null)

  if (!engine || !jobId) return null
  return { engine, jobId }
}

function hasUsableStatements(statements: ParsedStatement[]): boolean {
  return statements.some((statement) => statement.transactions.length > 0)
}

export async function storeParsedStatement(input: {
  documentId: string
  workspaceId: string
  expiresAt: string
  statement: ParsedStatement
}): Promise<void> {
  const persisted = statementPersistenceFields(input.statement)
  const { error } = await getProcessingStoreClient()
    .from('statement')
    .insert({
      document_id: input.documentId,
      workspace_id: input.workspaceId,
      statement_type: persisted.statementType,
      statement_metadata: persisted.metadata,
      bank_name: input.statement.bankName,
      account_last4: input.statement.accountLast4,
      period_start: input.statement.periodStart,
      period_end: input.statement.periodEnd,
      opening_balance: input.statement.openingBalance,
      closing_balance: input.statement.closingBalance,
      reported_total: input.statement.reportedTotal,
      computed_total: input.statement.computedTotal,
      reconciles: input.statement.reconciles,
      transactions: input.statement.transactions as unknown as Json,
      expires_at: input.expiresAt,
    })

  if (error) throw new Error('parsed_statement_write_failed')
}

function statementWithPersistenceDefaults(
  statement: ParsedStatement,
): ParsedStatement & StatementPersistenceFields {
  return {
    ...statement,
    ...statementPersistenceFields(statement),
  }
}

function statementPersistenceFields(statement: ParsedStatement): StatementPersistenceFields {
  const candidate = statement as ParsedStatement & {
    statementType?: unknown
    metadata?: unknown
  }

  return {
    statementType: candidate.statementType === 'credit_card' ? 'credit_card' : 'bank',
    metadata: isStatementMetadata(candidate.metadata) ? candidate.metadata : {},
  }
}

function isStatementMetadata(value: unknown): value is StatementMetadata {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

async function markDocumentReady(input: {
  documentId: string
  convertedAt: string
}): Promise<void> {
  const { data, error } = await getProcessingStoreClient()
    .from('document')
    .update({ status: 'ready', failure_reason: null, converted_at: input.convertedAt })
    .eq('id', input.documentId)
    .eq('status', 'processing')
    .select('id')
    .maybeSingle()

  if (error || !data) throw new Error('processing_document_ready_update_failed')
}

async function markDocumentFailed(input: {
  documentId: string
  failureReason: string
}): Promise<void> {
  const { data, error } = await getProcessingStoreClient()
    .from('document')
    .update({ status: 'failed', failure_reason: input.failureReason })
    .eq('id', input.documentId)
    .eq('status', 'processing')
    .select('id')
    .maybeSingle()

  if (error || !data) throw new Error('processing_document_failed_update_failed')
}

async function consumeCreditReservation(input: {
  documentId: string
  consumedAt: string
}): Promise<void> {
  const result = await consumeDocumentConversionCredit(input)
  if (!result.ok) throw new Error('credit_reservation_consume_failed')
}

async function releaseCreditReservation(input: {
  documentId: string
  releasedAt: string
}): Promise<void> {
  const result = await releaseDocumentConversionCredit(input)
  if (!result.ok) throw new Error('credit_reservation_release_failed')
}

async function failProcessingDocument(input: {
  deps: DocumentProcessingDependencies
  document: ProcessingDocument
  failureReason: string
  releasedAt: string
  input: ProcessTextractDocumentsInput
}): Promise<void> {
  await input.deps.releaseCreditReservation({
    documentId: input.document.id,
    releasedAt: input.releasedAt,
  })
  await input.deps.markDocumentFailed({
    documentId: input.document.id,
    failureReason: input.failureReason,
  })
  await input.deps.recordAuditEvent({
    eventType: 'document.processing_failed',
    workspaceId: input.document.workspaceId,
    actorUserId: null,
    targetType: 'document',
    targetId: input.document.id,
    metadata: auditMetadata(input.input, input.document, {
      failure_reason: input.failureReason,
    }),
  })
}

function auditMetadata(
  input: ProcessTextractDocumentsInput,
  document: ProcessingDocument,
  extra: Record<string, Json>,
): Json {
  const identity = extractionIdentity(document)

  return {
    trigger: input.trigger,
    extraction_engine: identity?.engine ?? null,
    extraction_job_id: identity?.jobId ?? null,
    textract_job_id:
      document.textractJobId ?? (identity?.engine === 'textract' ? identity.jobId : null),
    ...extra,
    request_id: input.routeContext?.requestId ?? null,
    trace_id: input.routeContext?.traceId ?? null,
  }
}

function getProcessingStoreClient(): ProcessingStoreClient {
  return getServiceRoleClient() as unknown as ProcessingStoreClient
}
