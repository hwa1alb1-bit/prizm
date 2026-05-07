import type { NextRequest } from 'next/server'
import { convertDocument } from '@/lib/server/document-conversion'
import { createRouteContext, getClientIp, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const context = createRouteContext(request)
  const auth = await requireAuthenticatedUser()

  if (!auth.ok) return problemResponse(context, auth.problem)

  const { documentId } = await params
  const result = await convertDocument({
    documentId,
    actorUserId: auth.context.user.id,
    actorIp: getClientIp(request),
    actorUserAgent: request.headers.get('user-agent'),
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

  return jsonResponse(context, {
    documentId: result.documentId,
    status: result.status,
    textractJobId: result.textractJobId,
    chargeStatus: result.chargeStatus,
    alreadyStarted: result.alreadyStarted,
    request_id: result.requestId,
    trace_id: result.traceId,
  })
}
