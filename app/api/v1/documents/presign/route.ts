import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { preflightDocumentUpload } from '@/lib/server/document-preflight'
import { createPendingDocumentUpload } from '@/lib/server/document-upload'
import { createRouteContext, getClientIp, jsonResponse, problemResponse } from '@/lib/server/http'
import { getS3Client, getUploadBucket, getKmsKeyId } from '@/lib/server/s3'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

const MAX_FILE_BYTES = 20 * 1024 * 1024

const requestSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .transform((s) => s.replace(/[^a-zA-Z0-9._-]/g, '_')),
  contentType: z.literal('application/pdf'),
  sizeBytes: z.number().int().min(1).max(MAX_FILE_BYTES),
  fileSha256: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .transform((value) => value.toLowerCase()),
  acceptedQuote: z.object({
    costCredits: z.literal(1),
    fileSha256: z
      .string()
      .regex(/^[a-fA-F0-9]{64}$/)
      .transform((value) => value.toLowerCase()),
  }),
})

export async function POST(request: NextRequest) {
  const context = createRouteContext(request)
  const auth = await requireAuthenticatedUser()

  if (!auth.ok) return problemResponse(context, auth.problem)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_INVALID_JSON',
      title: 'Invalid JSON',
      detail: 'The request body must be valid JSON.',
    })
  }

  if (Array.isArray(body)) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_BATCH_UNSUPPORTED',
      title: 'Batch presign is not supported',
      detail: 'Submit exactly one PDF presign request.',
    })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_UPLOAD_REQUEST',
      title: 'Invalid upload request',
      detail: parsed.error.issues[0]?.message ?? 'Invalid input.',
    })
  }

  const { filename, contentType, sizeBytes, fileSha256, acceptedQuote } = parsed.data
  if (fileSha256 !== acceptedQuote.fileSha256) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_QUOTE_MISMATCH',
      title: 'Accepted quote does not match file',
      detail: 'The accepted quote file hash must match the file being uploaded.',
    })
  }

  const preflight = await preflightDocumentUpload({
    filename,
    contentType,
    sizeBytes,
    fileSha256,
    actorUserId: auth.context.user.id,
    routeContext: context,
  })

  if (!preflight.ok) {
    return problemResponse(context, {
      status: preflight.status,
      code: preflight.code,
      title: preflight.title,
      detail: preflight.detail,
    })
  }

  if (!preflight.canConvert) {
    return problemResponse(
      context,
      preflight.duplicate.isDuplicate
        ? {
            status: 409,
            code: 'PRZM_DOCUMENT_DUPLICATE_ACTIVE',
            title: 'Duplicate document',
            detail: 'This PDF matches an active document in the workspace.',
          }
        : {
            status: 402,
            code: 'PRZM_CREDITS_INSUFFICIENT',
            title: 'Insufficient credits',
            detail: 'This workspace does not have enough credits to convert the document.',
          },
    )
  }

  const s3Key = `${auth.context.user.id}/${crypto.randomUUID()}/${filename}`
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const kmsKeyId = getKmsKeyId()
  const bucket = getUploadBucket()
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: contentType,
    ContentLength: sizeBytes,
    ServerSideEncryption: 'aws:kms',
    ...(kmsKeyId ? { SSEKMSKeyId: kmsKeyId } : {}),
  })

  let uploadUrl: string
  try {
    uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 600 })
  } catch {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_UPLOAD_PRESIGN_FAILED',
      title: 'Upload could not be prepared',
      detail: 'The upload URL could not be created. Try again later.',
    })
  }

  const document = await createPendingDocumentUpload({
    supabase: auth.context.supabase,
    filename,
    contentType,
    sizeBytes,
    fileSha256,
    conversionCostCredits: acceptedQuote.costCredits,
    s3Bucket: bucket,
    s3Key,
    expiresAt,
    actorIp: getClientIp(request),
    actorUserAgent: request.headers.get('user-agent'),
    routeContext: context,
  })

  if (!document.ok) {
    return problemResponse(context, uploadProblemFor(document.reason))
  }

  return jsonResponse(
    context,
    {
      uploadUrl,
      documentId: document.document.id,
      request_id: context.requestId,
      trace_id: context.traceId,
    },
    { status: 201 },
  )
}

function uploadProblemFor(reason: 'unauthorized' | 'no_workspace' | 'forbidden' | 'write_failed') {
  switch (reason) {
    case 'unauthorized':
      return {
        status: 401,
        code: 'PRZM_AUTH_UNAUTHORIZED',
        title: 'Authentication required',
        detail: 'Sign in before requesting an upload.',
      }
    case 'no_workspace':
      return {
        status: 403,
        code: 'PRZM_AUTH_WORKSPACE_REQUIRED',
        title: 'Workspace access required',
        detail: 'The signed-in user is not attached to a workspace.',
      }
    case 'forbidden':
      return {
        status: 403,
        code: 'PRZM_AUTH_FORBIDDEN',
        title: 'Forbidden',
        detail: 'Owner, admin, or member access is required to upload documents.',
      }
    case 'write_failed':
      return {
        status: 500,
        code: 'PRZM_INTERNAL_AUDITED_WRITE_FAILED',
        title: 'Upload could not be recorded',
        detail: 'The document and audit event could not be recorded atomically.',
      }
  }
}
