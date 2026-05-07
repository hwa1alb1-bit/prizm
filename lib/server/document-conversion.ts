import 'server-only'

import { StartDocumentAnalysisCommand } from '@aws-sdk/client-textract'
import { recordAuditEventOrThrow } from './audit'
import type { RouteContext } from './http'
import { getServiceRoleClient } from './supabase'
import { getTextractClient } from './textract'

const CONVERSION_ROLES = new Set(['owner', 'admin', 'member'])
const CONVERSION_COST_CREDITS = 1

export type ConversionProfile = {
  workspaceId: string
  role: string
}

export type ConversionDocument = {
  id: string
  workspaceId: string
  status: string
  s3Bucket: string
  s3Key: string
  textractJobId: string | null
  chargeStatus: string | null
  conversionCostCredits: number | null
  failureReason: string | null
}

export type ConvertDocumentInput = {
  documentId: string
  actorUserId: string
  actorIp: string | null
  actorUserAgent: string | null
  routeContext: RouteContext
}

export type ConvertDocumentSuccess = {
  ok: true
  documentId: string
  status: 'processing' | 'ready'
  textractJobId: string
  chargeStatus: string
  alreadyStarted: boolean
  requestId: string
  traceId: string
}

export type ConvertDocumentFailure = {
  ok: false
  reason:
    | 'workspace_required'
    | 'forbidden'
    | 'not_found'
    | 'conflict'
    | 'insufficient_balance'
    | 'reservation_failed'
    | 'textract_start_failed'
    | 'transition_failed'
  status: number
  code: string
  title: string
  detail: string
}

export type ConvertDocumentResult = ConvertDocumentSuccess | ConvertDocumentFailure

export type ReserveCreditResult =
  | { ok: true; chargeStatus: string }
  | { ok: false; reason: 'insufficient_balance' | 'reservation_failed' }

export type DocumentConversionDependencies = {
  getUserProfile: (userId: string) => Promise<ConversionProfile | null>
  getDocument: (documentId: string) => Promise<ConversionDocument | null>
  reserveCredit: (input: ReserveCreditInput) => Promise<ReserveCreditResult>
  startTextractAnalysis: (input: {
    documentId: string
    s3Bucket: string
    s3Key: string
  }) => Promise<string>
  markProcessingStarted: (input: ProcessingStartedInput) => Promise<void>
  markProcessingFailed: (input: ProcessingFailedInput) => Promise<void>
}

export type ReserveCreditInput = ConversionAuditInput & {
  costCredits: number
}

export type ProcessingStartedInput = ConversionAuditInput & {
  textractJobId: string
  chargeStatus: string
}

export type ProcessingFailedInput = ConversionAuditInput & {
  failureReason: string
}

type ConversionAuditInput = {
  documentId: string
  workspaceId: string
  actorUserId: string
  actorIp: string | null
  actorUserAgent: string | null
  requestId: string
  traceId: string
}

type ProfileRow = {
  workspace_id: string
  role: string
}

type DocumentRow = {
  id: string
  workspace_id: string
  status: string
  s3_bucket: string
  s3_key: string
  textract_job_id: string | null
  charge_status: string | null
  conversion_cost_credits: number | null
  failure_reason: string | null
}

type ReserveConversionCreditRow = {
  charge_status: string
}

type DocumentUpdateQuery = {
  eq: (column: string, value: string) => DocumentUpdateQuery
  select: (columns: string) => DocumentUpdateQuery
  maybeSingle: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>
}

export async function convertDocument(
  input: ConvertDocumentInput,
  deps: DocumentConversionDependencies = createDocumentConversionDependencies(),
): Promise<ConvertDocumentResult> {
  const profile = await deps.getUserProfile(input.actorUserId)
  if (!profile) return conversionProblem('workspace_required')
  if (!CONVERSION_ROLES.has(profile.role)) return conversionProblem('forbidden')

  const document = await deps.getDocument(input.documentId)
  if (!document) return conversionProblem('not_found')
  if (document.workspaceId !== profile.workspaceId) return conversionProblem('forbidden')

  if (document.textractJobId && (document.status === 'processing' || document.status === 'ready')) {
    return {
      ok: true,
      documentId: document.id,
      status: document.status === 'ready' ? 'ready' : 'processing',
      textractJobId: document.textractJobId,
      chargeStatus: document.chargeStatus ?? 'reserved',
      alreadyStarted: true,
      requestId: input.routeContext.requestId,
      traceId: input.routeContext.traceId,
    }
  }

  if (document.status !== 'verified') return conversionProblem('conflict')

  const audit = auditInput(input, document)
  const reservation = await deps.reserveCredit({
    ...audit,
    costCredits: document.conversionCostCredits ?? CONVERSION_COST_CREDITS,
  })

  if (!reservation.ok) return conversionProblem(reservation.reason)

  let textractJobId: string
  try {
    textractJobId = await deps.startTextractAnalysis({
      documentId: document.id,
      s3Bucket: document.s3Bucket,
      s3Key: document.s3Key,
    })
  } catch {
    const failureReason = 'Textract analysis could not be started for the verified upload.'
    try {
      await deps.markProcessingFailed({ ...audit, failureReason })
    } catch {
      return conversionProblem('transition_failed')
    }
    return conversionProblem('textract_start_failed')
  }

  try {
    await deps.markProcessingStarted({
      ...audit,
      textractJobId,
      chargeStatus: reservation.chargeStatus,
    })
  } catch {
    return conversionProblem('transition_failed')
  }

  return {
    ok: true,
    documentId: document.id,
    status: 'processing',
    textractJobId,
    chargeStatus: reservation.chargeStatus,
    alreadyStarted: false,
    requestId: input.routeContext.requestId,
    traceId: input.routeContext.traceId,
  }
}

function createDocumentConversionDependencies(): DocumentConversionDependencies {
  return {
    getUserProfile: getUserProfileForConversion,
    getDocument: getDocumentForConversion,
    reserveCredit,
    startTextractAnalysis,
    markProcessingStarted,
    markProcessingFailed,
  }
}

async function getUserProfileForConversion(userId: string): Promise<ConversionProfile | null> {
  const { data, error } = await getServiceRoleClient()
    .from('user_profile')
    .select('workspace_id, role')
    .eq('id', userId)
    .maybeSingle<ProfileRow>()

  if (error) throw new Error('conversion_profile_read_failed')
  if (!data) return null
  return {
    workspaceId: data.workspace_id,
    role: data.role,
  }
}

async function getDocumentForConversion(documentId: string): Promise<ConversionDocument | null> {
  const { data, error } = await getServiceRoleClient()
    .from('document')
    .select(
      [
        'id',
        'workspace_id',
        'status',
        's3_bucket',
        's3_key',
        'textract_job_id',
        'charge_status',
        'conversion_cost_credits',
        'failure_reason',
      ].join(', '),
    )
    .eq('id', documentId)
    .maybeSingle<DocumentRow>()

  if (error) throw new Error('conversion_document_read_failed')
  return data ? documentFromRow(data) : null
}

async function reserveCredit(input: ReserveCreditInput): Promise<ReserveCreditResult> {
  const rpcClient = getServiceRoleClient() as unknown as {
    rpc: (
      fn: 'reserve_document_conversion_credit',
      args: Record<string, unknown>,
    ) => Promise<{
      data: ReserveConversionCreditRow[] | null
      error: { message: string } | null
    }>
  }

  const { data, error } = await rpcClient.rpc('reserve_document_conversion_credit', {
    p_document_id: input.documentId,
    p_cost_credits: input.costCredits,
    p_request_id: input.requestId,
    p_trace_id: input.traceId,
    p_actor_ip: input.actorIp,
    p_actor_user_agent: input.actorUserAgent,
  })

  if (error) {
    if (error.message.includes('insufficient_balance')) {
      return { ok: false, reason: 'insufficient_balance' }
    }
    return { ok: false, reason: 'reservation_failed' }
  }

  const row = data?.[0]
  if (!row) return { ok: false, reason: 'reservation_failed' }
  return { ok: true, chargeStatus: row.charge_status }
}

async function startTextractAnalysis(input: {
  documentId: string
  s3Bucket: string
  s3Key: string
}): Promise<string> {
  const result = await getTextractClient().send(
    new StartDocumentAnalysisCommand({
      ClientRequestToken: textractClientToken(input.documentId),
      DocumentLocation: {
        S3Object: {
          Bucket: input.s3Bucket,
          Name: input.s3Key,
        },
      },
      FeatureTypes: ['TABLES', 'FORMS'],
    }),
  )

  if (!result.JobId) throw new Error('textract_job_id_missing')
  return result.JobId
}

async function markProcessingStarted(input: ProcessingStartedInput): Promise<void> {
  const client = getServiceRoleClient() as unknown as {
    from: (table: 'document') => {
      update: (values: Record<string, unknown>) => DocumentUpdateQuery
    }
  }

  const { data, error } = await client
    .from('document')
    .update({
      status: 'processing',
      textract_job_id: input.textractJobId,
      charge_status: input.chargeStatus,
      failure_reason: null,
    })
    .eq('id', input.documentId)
    .eq('status', 'verified')
    .select('id')
    .maybeSingle()

  if (error || !data) throw new Error('document_processing_started_update_failed')

  await recordAuditEventOrThrow({
    eventType: 'document.processing_started',
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    targetType: 'document',
    targetId: input.documentId,
    actorIp: input.actorIp,
    actorUserAgent: input.actorUserAgent,
    metadata: {
      textract_job_id: input.textractJobId,
      charge_status: input.chargeStatus,
      request_id: input.requestId,
      trace_id: input.traceId,
    },
  })
}

async function markProcessingFailed(input: ProcessingFailedInput): Promise<void> {
  const client = getServiceRoleClient() as unknown as {
    from: (table: 'document') => {
      update: (values: Record<string, unknown>) => DocumentUpdateQuery
    }
  }

  const { data, error } = await client
    .from('document')
    .update({
      status: 'failed',
      failure_reason: input.failureReason,
    })
    .eq('id', input.documentId)
    .eq('status', 'verified')
    .select('id')
    .maybeSingle()

  if (error || !data) throw new Error('document_processing_failed_update_failed')

  await recordAuditEventOrThrow({
    eventType: 'document.processing_failed',
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    targetType: 'document',
    targetId: input.documentId,
    actorIp: input.actorIp,
    actorUserAgent: input.actorUserAgent,
    metadata: {
      failure_reason: input.failureReason,
      request_id: input.requestId,
      trace_id: input.traceId,
    },
  })
}

function auditInput(
  input: ConvertDocumentInput,
  document: ConversionDocument,
): ConversionAuditInput {
  return {
    documentId: document.id,
    workspaceId: document.workspaceId,
    actorUserId: input.actorUserId,
    actorIp: input.actorIp,
    actorUserAgent: input.actorUserAgent,
    requestId: input.routeContext.requestId,
    traceId: input.routeContext.traceId,
  }
}

function documentFromRow(row: DocumentRow): ConversionDocument {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    status: row.status,
    s3Bucket: row.s3_bucket,
    s3Key: row.s3_key,
    textractJobId: row.textract_job_id,
    chargeStatus: row.charge_status,
    conversionCostCredits: row.conversion_cost_credits,
    failureReason: row.failure_reason,
  }
}

function conversionProblem(reason: ConvertDocumentFailure['reason']): ConvertDocumentFailure {
  switch (reason) {
    case 'workspace_required':
      return {
        ok: false,
        reason,
        status: 403,
        code: 'PRZM_AUTH_WORKSPACE_REQUIRED',
        title: 'Workspace access required',
        detail: 'The signed-in user is not attached to a workspace.',
      }
    case 'forbidden':
      return {
        ok: false,
        reason,
        status: 403,
        code: 'PRZM_AUTH_FORBIDDEN',
        title: 'Forbidden',
        detail: 'This document is not available in the current workspace.',
      }
    case 'not_found':
      return {
        ok: false,
        reason,
        status: 404,
        code: 'PRZM_DOCUMENT_NOT_FOUND',
        title: 'Document not found',
        detail: 'The requested document does not exist.',
      }
    case 'conflict':
      return {
        ok: false,
        reason,
        status: 409,
        code: 'PRZM_DOCUMENT_CONVERSION_CONFLICT',
        title: 'Document cannot be converted',
        detail: 'Only verified uploads can be converted.',
      }
    case 'insufficient_balance':
      return {
        ok: false,
        reason,
        status: 402,
        code: 'PRZM_CREDITS_INSUFFICIENT',
        title: 'Insufficient credits',
        detail: 'This workspace does not have enough credits to convert the document.',
      }
    case 'reservation_failed':
      return {
        ok: false,
        reason,
        status: 500,
        code: 'PRZM_INTERNAL_CREDIT_RESERVATION_FAILED',
        title: 'Credit could not be reserved',
        detail: 'The conversion credit could not be reserved safely.',
      }
    case 'textract_start_failed':
      return {
        ok: false,
        reason,
        status: 502,
        code: 'PRZM_TEXTRACT_START_FAILED',
        title: 'OCR could not be started',
        detail: 'The document was marked failed because Textract could not start analysis.',
      }
    case 'transition_failed':
      return {
        ok: false,
        reason,
        status: 500,
        code: 'PRZM_INTERNAL_DOCUMENT_TRANSITION_FAILED',
        title: 'Document state could not be recorded',
        detail: 'The conversion state could not be recorded safely.',
      }
  }
}

function textractClientToken(documentId: string): string {
  return documentId.replace(/[^A-Za-z0-9-_]/g, '_').slice(0, 64)
}
