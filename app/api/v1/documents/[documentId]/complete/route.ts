import type { NextRequest } from 'next/server'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { StartDocumentAnalysisCommand } from '@aws-sdk/client-textract'
import {
  attachTextractJobToDocument,
  claimPendingDocumentUploadCompletion,
  getDocumentProcessingStatus,
  getPendingDocumentForCompletion,
  markDocumentProcessingFailed,
  type PendingDocumentForCompletion,
} from '@/lib/server/document-processing'
import { createRouteContext, getClientIp, jsonResponse, problemResponse } from '@/lib/server/http'
import { rateLimit, type RateLimitResult } from '@/lib/server/ratelimit'
import { requireWorkspaceWriterUser } from '@/lib/server/route-auth'
import { getKmsKeyId, getS3Client } from '@/lib/server/s3'
import { getTextractClient } from '@/lib/server/textract'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
  contextInput: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const context = createRouteContext(request)
  const { documentId } = await contextInput.params

  if (!UUID_PATTERN.test(documentId)) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_DOCUMENT_ID',
      title: 'Invalid document ID',
      detail: 'The document ID must be a valid UUID.',
    })
  }

  const auth = await requireWorkspaceWriterUser()

  if (!auth.ok) return problemResponse(context, auth.problem)

  const limit = await applyRouteRateLimit(`document-complete:${auth.context.user.id}`, 60, 60)
  if (limit && !limit.success) {
    return rateLimitProblem(context, limit, {
      code: 'PRZM_RATE_LIMIT_UPLOAD_COMPLETE',
      title: 'Upload completion rate limit exceeded',
      detail: 'Wait before completing another document upload.',
    })
  }

  const pending = await getPendingDocumentForCompletion({
    supabase: auth.context.supabase,
    documentId,
  })

  if (!pending.ok) {
    if (
      pending.reason === 'not_pending' &&
      pending.status === 'processing' &&
      pending.textractJobId
    ) {
      return processingResponse(context, documentId, pending.textractJobId)
    }

    return problemResponse(context, pendingDocumentProblem(pending.reason))
  }

  const verification = await verifyUploadedObject(pending.document)
  if (!verification.ok) return problemResponse(context, verification.problem)

  const textractClientToken = textractTokenFor(pending.document.id)
  if (pending.document.status === 'pending') {
    const claimed = await claimPendingDocumentUploadCompletion({
      documentId,
      actorUserId: auth.context.user.id,
      textractClientToken,
      actorIp: getClientIp(request),
      actorUserAgent: request.headers.get('user-agent'),
      routeContext: context,
    })

    if (!claimed.ok) {
      const replay = await replayProcessingDocument(auth.context.supabase, documentId, context)
      if (replay) return replay

      return problemResponse(context, completeDocumentProblem(claimed.reason))
    }
  }

  const textract = await startTextractAnalysis(pending.document, textractClientToken)
  if (!textract.ok) {
    const failed = await markDocumentProcessingFailed({
      documentId,
      actorUserId: auth.context.user.id,
      failureReason: failureReasonForTextractProblem(textract.problem.code),
      textractJobId: null,
      routeContext: context,
    })
    if (!failed.ok) return problemResponse(context, processingFailureWriteProblem())
    return problemResponse(context, textract.problem)
  }

  const attached = await attachTextractJobToDocument({
    documentId,
    actorUserId: auth.context.user.id,
    textractJobId: textract.jobId,
    routeContext: context,
  })

  if (!attached.ok) {
    const failed = await markDocumentProcessingFailed({
      documentId,
      actorUserId: auth.context.user.id,
      failureReason: 'textract_job_record_failed',
      textractJobId: textract.jobId,
      routeContext: context,
    })
    if (!failed.ok) return problemResponse(context, processingFailureWriteProblem())
    return problemResponse(context, completeDocumentProblem(attached.reason))
  }

  return processingResponse(context, documentId, textract.jobId)
}

async function replayProcessingDocument(
  supabase: Parameters<typeof getDocumentProcessingStatus>[0]['supabase'],
  documentId: string,
  context: ReturnType<typeof createRouteContext>,
): Promise<Response | null> {
  const status = await getDocumentProcessingStatus({ supabase, documentId })
  if (!status.ok) return null
  if (status.document.status === 'processing' && status.document.textractJobId) {
    return processingResponse(context, documentId, status.document.textractJobId)
  }
  return null
}

function processingResponse(
  context: ReturnType<typeof createRouteContext>,
  documentId: string,
  textractJobId: string,
): Response {
  return jsonResponse(
    context,
    {
      documentId,
      status: 'processing',
      textractJobId,
      statusUrl: `/api/v1/documents/${documentId}/status`,
      request_id: context.requestId,
      trace_id: context.traceId,
    },
    {
      status: 202,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}

async function verifyUploadedObject(document: PendingDocumentForCompletion): Promise<
  | { ok: true }
  | {
      ok: false
      problem: {
        status: number
        code: string
        title: string
        detail: string
      }
    }
> {
  try {
    const result = await getS3Client().send(
      new HeadObjectCommand({
        Bucket: document.s3Bucket,
        Key: document.s3Key,
      }),
    )

    if (result.ContentLength !== document.sizeBytes) {
      return uploadVerificationProblem(
        'PRZM_UPLOAD_OBJECT_SIZE_MISMATCH',
        'Uploaded object size mismatch',
        'The uploaded object size does not match the presigned upload request.',
      )
    }

    if (result.ContentType !== document.contentType) {
      return uploadVerificationProblem(
        'PRZM_UPLOAD_OBJECT_CONTENT_TYPE_MISMATCH',
        'Uploaded object content type mismatch',
        'The uploaded object content type does not match the presigned upload request.',
      )
    }

    if (result.ServerSideEncryption !== 'aws:kms') {
      return uploadVerificationProblem(
        'PRZM_UPLOAD_OBJECT_ENCRYPTION_MISSING',
        'Uploaded object encryption could not be verified',
        'The uploaded object must be encrypted with AWS KMS before processing starts.',
      )
    }

    const kmsKeyId = getKmsKeyId()
    if (!kmsKeyId) {
      return {
        ok: false,
        problem: {
          status: 500,
          code: 'PRZM_INTERNAL_UPLOAD_KMS_CONFIG',
          title: 'Upload KMS key is not configured',
          detail: 'The expected upload KMS key is required before processing can start.',
        },
      }
    }

    if (result.SSEKMSKeyId !== kmsKeyId) {
      return uploadVerificationProblem(
        'PRZM_UPLOAD_OBJECT_KMS_KEY_MISMATCH',
        'Uploaded object KMS key mismatch',
        'The uploaded object KMS key does not match the configured upload key.',
      )
    }

    return { ok: true }
  } catch {
    return uploadVerificationProblem(
      'PRZM_UPLOAD_OBJECT_NOT_FOUND',
      'Uploaded object could not be verified',
      'The uploaded object was not found or is not readable yet.',
    )
  }
}

async function applyRouteRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult | null> {
  try {
    return await rateLimit(key, limit, windowSec)
  } catch (err) {
    console.warn(
      `[rate-limit] fail-open for ${key}: ${err instanceof Error ? err.message : String(err)}`,
    )
    return null
  }
}

function rateLimitProblem(
  context: ReturnType<typeof createRouteContext>,
  limit: RateLimitResult,
  problem: { code: string; title: string; detail: string },
): Response {
  const response = problemResponse(context, {
    status: 429,
    code: problem.code,
    title: problem.title,
    detail: problem.detail,
  })
  response.headers.set('Retry-After', String(limit.resetSeconds))
  response.headers.set('RateLimit-Limit', String(limit.limit))
  response.headers.set('RateLimit-Remaining', String(limit.remaining))
  response.headers.set('RateLimit-Reset', String(limit.resetSeconds))
  return response
}

async function startTextractAnalysis(
  document: PendingDocumentForCompletion,
  textractClientToken: string,
): Promise<
  | { ok: true; jobId: string }
  | {
      ok: false
      problem: {
        status: number
        code: string
        title: string
        detail: string
      }
    }
> {
  try {
    const result = await getTextractClient().send(
      new StartDocumentAnalysisCommand({
        ClientRequestToken: textractClientToken,
        DocumentLocation: {
          S3Object: {
            Bucket: document.s3Bucket,
            Name: document.s3Key,
          },
        },
        FeatureTypes: ['TABLES', 'FORMS'],
      }),
    )

    if (!result.JobId) {
      return {
        ok: false,
        problem: {
          status: 502,
          code: 'PRZM_TEXTRACT_JOB_MISSING',
          title: 'Textract processing did not start',
          detail: 'Textract did not return a processing job ID.',
        },
      }
    }

    return { ok: true, jobId: result.JobId }
  } catch {
    return {
      ok: false,
      problem: {
        status: 502,
        code: 'PRZM_TEXTRACT_START_FAILED',
        title: 'Textract processing could not start',
        detail: 'The uploaded document could not be submitted for Textract analysis.',
      },
    }
  }
}

function textractTokenFor(documentId: string): string {
  return documentId.replaceAll('-', '').slice(0, 64)
}

function failureReasonForTextractProblem(code: string): string {
  return code === 'PRZM_TEXTRACT_JOB_MISSING' ? 'textract_job_missing' : 'textract_start_failed'
}

function processingFailureWriteProblem() {
  return {
    status: 500,
    code: 'PRZM_INTERNAL_PROCESSING_FAILURE_WRITE_FAILED',
    title: 'Processing failure could not be recorded',
    detail: 'The processing failure state and audit event could not be recorded.',
  }
}

function uploadVerificationProblem(
  code: string,
  title: string,
  detail: string,
): {
  ok: false
  problem: {
    status: number
    code: string
    title: string
    detail: string
  }
} {
  return {
    ok: false,
    problem: {
      status: 409,
      code,
      title,
      detail,
    },
  }
}

function pendingDocumentProblem(reason: 'not_found' | 'not_pending' | 'read_failed') {
  switch (reason) {
    case 'not_found':
      return {
        status: 404,
        code: 'PRZM_DOCUMENT_NOT_FOUND',
        title: 'Document not found',
        detail: 'The document does not exist or is not available to this workspace.',
      }
    case 'not_pending':
      return {
        status: 409,
        code: 'PRZM_DOCUMENT_NOT_PENDING',
        title: 'Document is not pending upload completion',
        detail: 'Only pending documents can be completed.',
      }
    case 'read_failed':
      return {
        status: 500,
        code: 'PRZM_INTERNAL_DOCUMENT_READ_FAILED',
        title: 'Document could not be read',
        detail: 'The document state could not be checked. Try again later.',
      }
  }
}

function completeDocumentProblem(reason: 'not_found' | 'not_pending' | 'write_failed') {
  switch (reason) {
    case 'not_found':
      return {
        status: 404,
        code: 'PRZM_DOCUMENT_NOT_FOUND',
        title: 'Document not found',
        detail: 'The document does not exist or is not available to this workspace.',
      }
    case 'not_pending':
      return {
        status: 409,
        code: 'PRZM_DOCUMENT_NOT_PENDING',
        title: 'Document is not pending upload completion',
        detail: 'The document changed state before processing could be recorded.',
      }
    case 'write_failed':
      return {
        status: 500,
        code: 'PRZM_INTERNAL_PROCESSING_STATE_WRITE_FAILED',
        title: 'Processing state could not be recorded',
        detail: 'The Textract job could not be recorded with the document audit trail.',
      }
  }
}
