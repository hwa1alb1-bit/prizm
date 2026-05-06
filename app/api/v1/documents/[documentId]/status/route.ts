import type { NextRequest } from 'next/server'
import { getDocumentProcessingStatus } from '@/lib/server/document-processing'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'
import { rateLimit, type RateLimitResult } from '@/lib/server/ratelimit'
import { requireWorkspaceMemberUser } from '@/lib/server/route-auth'
import { getTextractDocumentStatus } from '@/lib/server/textract'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
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

  const auth = await requireWorkspaceMemberUser()

  if (!auth.ok) return problemResponse(context, auth.problem)

  const limit = await applyRouteRateLimit(`document-status:${auth.context.user.id}`, 1200, 60)
  if (limit && !limit.success) {
    return rateLimitProblem(context, limit)
  }

  const status = await getDocumentProcessingStatus({
    supabase: auth.context.supabase,
    documentId,
  })

  if (!status.ok) return problemResponse(context, statusProblem(status.reason))

  const textract =
    status.document.status === 'processing' && status.document.textractJobId
      ? await textractStatusBody(status.document.textractJobId)
      : null

  return jsonResponse(
    context,
    {
      documentId: status.document.id,
      status: status.document.status,
      textract,
      pages: status.document.pages,
      failureReason: status.document.failureReason,
      request_id: context.requestId,
      trace_id: context.traceId,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}

async function textractStatusBody(jobId: string): Promise<{
  jobId: string
  status: string
  errorCode?: string
}> {
  const result = await getTextractDocumentStatus(jobId)
  if (result.ok) return { jobId, status: result.status }
  return { jobId, status: 'UNKNOWN', errorCode: result.errorCode }
}

function statusProblem(reason: 'not_found' | 'read_failed') {
  switch (reason) {
    case 'not_found':
      return {
        status: 404,
        code: 'PRZM_DOCUMENT_NOT_FOUND',
        title: 'Document not found',
        detail: 'The document does not exist or is not available to this workspace.',
      }
    case 'read_failed':
      return {
        status: 500,
        code: 'PRZM_INTERNAL_DOCUMENT_READ_FAILED',
        title: 'Document status could not be read',
        detail: 'The document processing status could not be checked. Try again later.',
      }
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
): Response {
  const response = problemResponse(context, {
    status: 429,
    code: 'PRZM_RATE_LIMIT_STATUS_POLL',
    title: 'Status polling rate limit exceeded',
    detail: 'Wait before polling document status again.',
  })
  response.headers.set('Retry-After', String(limit.resetSeconds))
  response.headers.set('RateLimit-Limit', String(limit.limit))
  response.headers.set('RateLimit-Remaining', String(limit.remaining))
  response.headers.set('RateLimit-Reset', String(limit.resetSeconds))
  return response
}
