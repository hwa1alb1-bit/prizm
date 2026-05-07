import type { NextRequest } from 'next/server'
import { getStatementExportDownload } from '@/lib/server/statement-export'
import { createRouteContext, getClientIp, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> },
) {
  const context = createRouteContext(request)
  const auth = await requireAuthenticatedUser()
  if (!auth.ok) return problemResponse(context, auth.problem)

  const { exportId } = await params
  const result = await getStatementExportDownload({
    exportId,
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
    exportId: result.exportId,
    downloadUrl: result.downloadUrl,
    expiresInSeconds: result.expiresInSeconds,
    request_id: result.requestId,
    trace_id: result.traceId,
  })
}
