import type { NextRequest } from 'next/server'
import { getDocumentStatus } from '@/lib/server/document-status'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'
import { applyAuthenticatedRateLimit, withRateLimitHeaders } from '@/lib/server/route-rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const context = createRouteContext(request)
  const auth = await requireAuthenticatedUser()

  if (!auth.ok) return problemResponse(context, auth.problem)

  const rateLimitDecision = await applyAuthenticatedRateLimit(
    context,
    'status',
    auth.context.user.id,
  )
  if (!rateLimitDecision.ok) return rateLimitDecision.response

  const { documentId } = await params
  const result = await getDocumentStatus({
    documentId,
    actorUserId: auth.context.user.id,
    routeContext: context,
  })

  if (!result.ok) {
    return problemResponse(context, {
      status: result.status,
      code: result.code,
      title: result.title,
      detail: result.detail,
    })
  }

  return withRateLimitHeaders(
    jsonResponse(context, {
      documentId: result.documentId,
      state: result.state,
      extractionEngine: result.extractionEngine,
      extractionJobId: result.extractionJobId,
      textractJobId: result.textractJobId,
      chargeStatus: result.chargeStatus,
      duplicate: result.duplicate,
      retention: result.retention,
      request_id: result.requestId,
      trace_id: result.traceId,
    }),
    rateLimitDecision.result,
  )
}
