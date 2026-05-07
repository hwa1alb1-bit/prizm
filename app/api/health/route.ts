import { NextRequest } from 'next/server'
import { collectHealthSnapshot } from '@/lib/server/health'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'
import { getReleaseVersion } from '@/lib/server/release'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest): Promise<Response> {
  const context = createRouteContext(req)
  const url = new URL(req.url)

  if (url.searchParams.get('deep') === 'true') {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_DEEP_HEALTH_NOT_PUBLIC',
      title: 'Deep health is not public',
      detail: 'Use the protected /api/ops/health route for live provider health checks.',
    })
  }

  const snapshot = await collectHealthSnapshot({ deep: false, includeErrorCodes: false })

  return jsonResponse(
    context,
    {
      status: snapshot.status,
      mode: 'shallow',
      timestamp: new Date().toISOString(),
      version: getReleaseVersion(),
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
