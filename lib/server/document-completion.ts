import 'server-only'

import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { StartDocumentAnalysisCommand } from '@aws-sdk/client-textract'
import type { Json } from '../shared/db-types'
import { recordAuditEventOrThrow } from './audit'
import type { RouteContext } from './http'
import { getS3Client, getKmsKeyId, getUploadBucket } from './s3'
import { getServiceRoleClient } from './supabase'
import { getTextractClient } from './textract'

export type CompletionDocument = {
  id: string
  workspaceId: string
  uploadedBy: string
  status: string
  filename: string
  contentType: string
  sizeBytes: number
  s3Bucket: string
  s3Key: string
  textractJobId: string | null
  failureReason: string | null
}

export type CompletionProfile = {
  workspaceId: string
  role: string
}

export type S3ObjectEvidence = {
  contentLength: number | undefined
  contentType: string | undefined
  serverSideEncryption: string | undefined
  sseKmsKeyId?: string | undefined
}

export type VerifiedUploadEvidence = {
  s3Bucket: string
  s3Key: string
  sizeBytes: number
  contentType: string
  serverSideEncryption: string
  sseKmsKeyId: string | null
}

export type CompleteDocumentUploadInput = {
  documentId: string
  actorUserId: string
  actorIp: string | null
  actorUserAgent: string | null
  routeContext: RouteContext
}

export type CompleteDocumentUploadSuccess = {
  ok: true
  documentId: string
  state: 'verified' | 'processing' | 'ready'
  alreadyCompleted: boolean
  requestId: string
  traceId: string
}

export type CompleteDocumentUploadFailure = {
  ok: false
  reason:
    | 'workspace_required'
    | 'forbidden'
    | 'not_found'
    | 'conflict'
    | 's3_object_missing'
    | 's3_metadata_mismatch'
    | 's3_verification_failed'
    | 'transition_failed'
    | 'textract_start_failed'
  status: number
  code: string
  title: string
  detail: string
}

export type CompleteDocumentUploadResult =
  | CompleteDocumentUploadSuccess
  | CompleteDocumentUploadFailure

export type DocumentCompletionDependencies = {
  getUploadBucket: () => string
  getKmsKeyId: () => string | undefined
  getUserProfile: (userId: string) => Promise<CompletionProfile | null>
  getDocument: (documentId: string) => Promise<CompletionDocument | null>
  headObject: (input: { s3Bucket: string; s3Key: string }) => Promise<S3ObjectEvidence>
  markUploadCompleted: (input: UploadCompletedInput) => Promise<void>
  startTextractAnalysis: (input: {
    documentId: string
    s3Bucket: string
    s3Key: string
  }) => Promise<string>
  markProcessingStarted: (input: ProcessingStartedInput) => Promise<void>
  markProcessingFailed: (input: ProcessingFailedInput) => Promise<void>
}

export type UploadCompletedInput = CompletionAuditInput & {
  eventType: 'document.upload_completed'
  verification: VerifiedUploadEvidence
}

export type ProcessingStartedInput = CompletionAuditInput & {
  eventType: 'document.processing_started'
  textractJobId: string
  verification: VerifiedUploadEvidence
}

export type ProcessingFailedInput = CompletionAuditInput & {
  eventType: 'document.processing_failed'
  failureReason: string
}

type CompletionAuditInput = {
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
  uploaded_by: string
  status: string
  filename: string
  content_type: string
  size_bytes: number
  s3_bucket: string
  s3_key: string
  textract_job_id: string | null
  failure_reason: string | null
}

const COMPLETION_ROLES = new Set(['owner', 'admin', 'member'])

export async function completeDocumentUpload(
  input: CompleteDocumentUploadInput,
  deps: DocumentCompletionDependencies = createDocumentCompletionDependencies(),
): Promise<CompleteDocumentUploadResult> {
  const profile = await deps.getUserProfile(input.actorUserId)
  if (!profile) return completionProblem('workspace_required')
  if (!COMPLETION_ROLES.has(profile.role)) return completionProblem('forbidden')

  const document = await deps.getDocument(input.documentId)
  if (!document) return completionProblem('not_found')
  if (document.workspaceId !== profile.workspaceId) return completionProblem('forbidden')

  if (isAlreadyCompleted(document)) {
    return {
      ok: true,
      documentId: document.id,
      state: completedState(document.status),
      alreadyCompleted: true,
      requestId: input.routeContext.requestId,
      traceId: input.routeContext.traceId,
    }
  }

  if (document.status !== 'pending' && document.status !== 'processing') {
    return completionProblem('conflict')
  }

  const staticMismatch = staticDocumentMismatches(document, deps.getUploadBucket())
  if (staticMismatch.length > 0) {
    return failClosed(input, deps, document, metadataMismatchReason(staticMismatch))
  }

  let head: S3ObjectEvidence
  try {
    head = await deps.headObject({
      s3Bucket: document.s3Bucket,
      s3Key: document.s3Key,
    })
  } catch (err) {
    if (isS3NotFound(err)) {
      return failClosed(input, deps, document, 'S3 object was not found for the pending upload.')
    }
    return completionProblem('s3_verification_failed')
  }

  const evidence = verifyS3Object(document, head, deps.getKmsKeyId())
  if (!evidence.ok) {
    return failClosed(input, deps, document, metadataMismatchReason(evidence.mismatches))
  }

  try {
    await deps.markUploadCompleted({
      ...auditInput(input, document),
      eventType: 'document.upload_completed',
      verification: evidence.verification,
    })
  } catch {
    return completionProblem('transition_failed')
  }

  return {
    ok: true,
    documentId: document.id,
    state: 'verified',
    alreadyCompleted: false,
    requestId: input.routeContext.requestId,
    traceId: input.routeContext.traceId,
  }
}

function createDocumentCompletionDependencies(): DocumentCompletionDependencies {
  return {
    getUploadBucket,
    getKmsKeyId,
    getUserProfile: getUserProfileForCompletion,
    getDocument: getDocumentForCompletion,
    headObject: headUploadedObject,
    markUploadCompleted,
    startTextractAnalysis,
    markProcessingStarted,
    markProcessingFailed,
  }
}

async function getUserProfileForCompletion(userId: string): Promise<CompletionProfile | null> {
  const { data, error } = await getServiceRoleClient()
    .from('user_profile')
    .select('workspace_id, role')
    .eq('id', userId)
    .maybeSingle<ProfileRow>()

  if (error) throw new Error('completion_profile_read_failed')
  if (!data) return null
  return {
    workspaceId: data.workspace_id,
    role: data.role,
  }
}

async function getDocumentForCompletion(documentId: string): Promise<CompletionDocument | null> {
  const { data, error } = await getServiceRoleClient()
    .from('document')
    .select(
      [
        'id',
        'workspace_id',
        'uploaded_by',
        'status',
        'filename',
        'content_type',
        'size_bytes',
        's3_bucket',
        's3_key',
        'textract_job_id',
        'failure_reason',
      ].join(', '),
    )
    .eq('id', documentId)
    .maybeSingle<DocumentRow>()

  if (error) throw new Error('completion_document_read_failed')
  return data ? documentFromRow(data) : null
}

async function headUploadedObject(input: {
  s3Bucket: string
  s3Key: string
}): Promise<S3ObjectEvidence> {
  const result = await getS3Client().send(
    new HeadObjectCommand({
      Bucket: input.s3Bucket,
      Key: input.s3Key,
    }),
  )

  return {
    contentLength: result.ContentLength,
    contentType: result.ContentType,
    serverSideEncryption: result.ServerSideEncryption,
    sseKmsKeyId: result.SSEKMSKeyId,
  }
}

async function markUploadCompleted(input: UploadCompletedInput): Promise<void> {
  const { data, error } = await getServiceRoleClient()
    .from('document')
    .update({
      status: 'verified',
      failure_reason: null,
    })
    .eq('id', input.documentId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error || !data) throw new Error('document_upload_completed_update_failed')

  await recordAuditEventOrThrow({
    eventType: input.eventType,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    targetType: 'document',
    targetId: input.documentId,
    actorIp: input.actorIp,
    actorUserAgent: input.actorUserAgent,
    metadata: auditMetadata(input, {
      s3_bucket: input.verification.s3Bucket,
      s3_key: input.verification.s3Key,
      size_bytes: input.verification.sizeBytes,
      content_type: input.verification.contentType,
      server_side_encryption: input.verification.serverSideEncryption,
      sse_kms_key_id: input.verification.sseKmsKeyId,
    }),
  })
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
  const { data, error } = await getServiceRoleClient()
    .from('document')
    .update({
      status: 'processing',
      textract_job_id: input.textractJobId,
      failure_reason: null,
    })
    .eq('id', input.documentId)
    .eq('status', 'processing')
    .select('id')
    .maybeSingle()

  if (error || !data) throw new Error('document_processing_started_update_failed')

  await recordAuditEventOrThrow({
    eventType: input.eventType,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    targetType: 'document',
    targetId: input.documentId,
    actorIp: input.actorIp,
    actorUserAgent: input.actorUserAgent,
    metadata: auditMetadata(input, {
      textract_job_id: input.textractJobId,
      s3_bucket: input.verification.s3Bucket,
      s3_key: input.verification.s3Key,
    }),
  })
}

async function markProcessingFailed(input: ProcessingFailedInput): Promise<void> {
  const { data, error } = await getServiceRoleClient()
    .from('document')
    .update({
      status: 'failed',
      failure_reason: input.failureReason,
    })
    .eq('id', input.documentId)
    .in('status', ['pending', 'processing'])
    .select('id')
    .maybeSingle()

  if (error || !data) throw new Error('document_processing_failed_update_failed')

  await recordAuditEventOrThrow({
    eventType: input.eventType,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    targetType: 'document',
    targetId: input.documentId,
    actorIp: input.actorIp,
    actorUserAgent: input.actorUserAgent,
    metadata: auditMetadata(input, {
      failure_reason: input.failureReason,
    }),
  })
}

function verifyS3Object(
  document: CompletionDocument,
  head: S3ObjectEvidence,
  kmsKeyId: string | undefined,
): { ok: true; verification: VerifiedUploadEvidence } | { ok: false; mismatches: string[] } {
  const mismatches: string[] = []
  if (head.contentLength !== document.sizeBytes) mismatches.push('size_bytes')
  if (normalizeContentType(head.contentType) !== document.contentType) {
    mismatches.push('content_type')
  }
  if (head.serverSideEncryption !== 'aws:kms') {
    mismatches.push('server_side_encryption')
  }
  if (kmsKeyId && head.sseKmsKeyId && !kmsKeyMatches(head.sseKmsKeyId, kmsKeyId)) {
    mismatches.push('sse_kms_key_id')
  }

  if (mismatches.length > 0) return { ok: false, mismatches }

  return {
    ok: true,
    verification: {
      s3Bucket: document.s3Bucket,
      s3Key: document.s3Key,
      sizeBytes: document.sizeBytes,
      contentType: document.contentType,
      serverSideEncryption: head.serverSideEncryption ?? 'aws:kms',
      sseKmsKeyId: head.sseKmsKeyId ?? null,
    },
  }
}

function staticDocumentMismatches(
  document: CompletionDocument,
  configuredBucket: string,
): string[] {
  const mismatches: string[] = []
  if (document.s3Bucket !== configuredBucket) mismatches.push('s3_bucket')
  if (!document.s3Key || !document.s3Key.startsWith(`${document.uploadedBy}/`)) {
    mismatches.push('s3_key')
  }
  return mismatches
}

async function failClosed(
  input: CompleteDocumentUploadInput,
  deps: DocumentCompletionDependencies,
  document: CompletionDocument,
  failureReason: string,
): Promise<CompleteDocumentUploadFailure> {
  try {
    await deps.markProcessingFailed({
      ...auditInput(input, document),
      eventType: 'document.processing_failed',
      failureReason,
    })
  } catch {
    return completionProblem('transition_failed')
  }

  if (failureReason === 'S3 object was not found for the pending upload.') {
    return completionProblem('s3_object_missing')
  }

  return completionProblem('s3_metadata_mismatch', failureReason)
}

function auditInput(
  input: CompleteDocumentUploadInput,
  document: CompletionDocument,
): CompletionAuditInput {
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

function auditMetadata(input: CompletionAuditInput, extra: Record<string, Json | undefined>): Json {
  return Object.fromEntries(
    Object.entries({
      request_id: input.requestId,
      trace_id: input.traceId,
      ...extra,
    }).filter(([, value]) => value !== undefined),
  ) as Json
}

function completionProblem(
  reason: CompleteDocumentUploadFailure['reason'],
  detailOverride?: string,
): CompleteDocumentUploadFailure {
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
        code: 'PRZM_DOCUMENT_COMPLETION_CONFLICT',
        title: 'Document cannot be completed',
        detail: 'Only pending uploads can be completed.',
      }
    case 's3_object_missing':
      return {
        ok: false,
        reason,
        status: 409,
        code: 'PRZM_DOCUMENT_UPLOAD_OBJECT_MISSING',
        title: 'Upload object was not found',
        detail: 'The document was marked failed because the expected S3 object was missing.',
      }
    case 's3_metadata_mismatch':
      return {
        ok: false,
        reason,
        status: 409,
        code: 'PRZM_DOCUMENT_UPLOAD_METADATA_MISMATCH',
        title: 'Upload verification failed',
        detail:
          detailOverride ??
          'The document was marked failed because the uploaded object metadata did not match.',
      }
    case 's3_verification_failed':
      return {
        ok: false,
        reason,
        status: 502,
        code: 'PRZM_STORAGE_VERIFICATION_FAILED',
        title: 'Upload could not be verified',
        detail: 'PRIZM could not verify the uploaded object. Try again shortly.',
      }
    case 'transition_failed':
      return {
        ok: false,
        reason,
        status: 500,
        code: 'PRZM_INTERNAL_DOCUMENT_TRANSITION_FAILED',
        title: 'Document state could not be recorded',
        detail: 'The verified upload could not be recorded safely.',
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
  }
}

function documentFromRow(row: DocumentRow): CompletionDocument {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    uploadedBy: row.uploaded_by,
    status: row.status,
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    s3Bucket: row.s3_bucket,
    s3Key: row.s3_key,
    textractJobId: row.textract_job_id,
    failureReason: row.failure_reason,
  }
}

function isAlreadyCompleted(document: CompletionDocument): boolean {
  return (
    document.status === 'verified' ||
    document.status === 'processing' ||
    document.status === 'ready'
  )
}

function completedState(status: string): 'verified' | 'processing' | 'ready' {
  if (status === 'ready') return 'ready'
  if (status === 'processing') return 'processing'
  return 'verified'
}

function metadataMismatchReason(mismatches: string[]): string {
  return `S3 object metadata did not match the pending upload record: ${mismatches.join(', ')}.`
}

function normalizeContentType(value: string | undefined): string | undefined {
  return value?.split(';')[0]?.trim().toLowerCase()
}

function kmsKeyMatches(actual: string, expected: string): boolean {
  return actual === expected || actual.endsWith(`/${expected}`) || expected.endsWith(`/${actual}`)
}

function textractClientToken(documentId: string): string {
  return documentId.replace(/[^A-Za-z0-9-_]/g, '_').slice(0, 64)
}

function isS3NotFound(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const candidate = err as Error & { name?: string; $metadata?: { httpStatusCode?: number } }
  return (
    candidate.name === 'NotFound' ||
    candidate.name === 'NoSuchKey' ||
    candidate.$metadata?.httpStatusCode === 404
  )
}
