import type { NextRequest } from 'next/server'
import { recordAuditEvent } from '@/lib/server/audit'
import { createRouteContext, getClientIp, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireOpsAdminUser } from '@/lib/server/route-auth'
import { listLatestOpsSnapshots } from '@/lib/server/ops/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<Response> {
  const context = createRouteContext(request)
  const auth = await requireOpsAdminUser()

  if (!auth.ok) {
    return problemResponse(context, auth.problem)
  }

  const audit = await recordAuditEvent({
    eventType: 'ops.dashboard_read',
    actorUserId: auth.context.user.id,
    targetType: 'ops_dashboard',
    metadata: {
      route: '/api/ops/snapshots',
      request_id: context.requestId,
      trace_id: context.traceId,
    },
    actorIp: getClientIp(request),
    actorUserAgent: request.headers.get('user-agent'),
  })

  if (!audit.ok) {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_AUDIT_WRITE_FAILED',
      title: 'Dashboard read could not be audited',
      detail:
        'The Ops Dashboard read was not completed because its audit event could not be recorded.',
    })
  }

  const snapshots = await listLatestOpsSnapshots()

  return jsonResponse(
    context,
    {
      snapshots,
      request_id: context.requestId,
      trace_id: context.traceId,
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
