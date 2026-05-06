import { NextRequest } from 'next/server'
import { collectHealthSnapshot } from '@/lib/server/health'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireOpsAdminUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest): Promise<Response> {
  const context = createRouteContext(req)
  const auth = await requireOpsAdminUser()

  if (!auth.ok) {
    return problemResponse(context, auth.problem)
  }

  const snapshot = await collectHealthSnapshot({ deep: true, includeErrorCodes: true })

  return jsonResponse(
    context,
    {
      status: snapshot.status,
      mode: 'deep',
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_GIT_SHA ?? 'dev',
      connectors: snapshot.connectors,
      request_id: context.requestId,
      trace_id: context.traceId,
    },
    {
      status: snapshot.httpStatus,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
