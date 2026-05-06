import type { NextRequest } from 'next/server'
import { completeDocumentUpload } from '@/lib/server/document-completion'
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
  const result = await completeDocumentUpload({
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
    status: result.state,
    textractJobId: result.textractJobId,
    alreadyCompleted: result.alreadyCompleted,
    request_id: result.requestId,
    trace_id: result.traceId,
  })
}
