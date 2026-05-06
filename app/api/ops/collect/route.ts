import type { NextRequest } from 'next/server'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'
import { collectOpsSnapshots } from '@/lib/server/ops/collector'
import { serverEnv } from '@/lib/shared/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<Response> {
  return collectFromAuthorizedRequest(request)
}

export async function GET(request: NextRequest): Promise<Response> {
  return collectFromAuthorizedRequest(request)
}

async function collectFromAuthorizedRequest(request: NextRequest): Promise<Response> {
  const context = createRouteContext(request)

  if (!isAuthorizedCronRequest(request)) {
    return problemResponse(context, {
      status: 401,
      code: 'PRZM_AUTH_CRON_UNAUTHORIZED',
      title: 'Cron authorization required',
      detail: 'A valid cron secret is required to collect provider snapshots.',
    })
  }

  const result = await collectOpsSnapshots({ trigger: 'cron' })

  return jsonResponse(
    context,
    {
      ...result,
      request_id: context.requestId,
      trace_id: context.traceId,
    },
    {
      status: result.status === 'failed' ? 500 : 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}

function isAuthorizedCronRequest(request: Request): boolean {
  const secret = serverEnv.CRON_SECRET
  if (!secret) return false

  const authorization = request.headers.get('authorization')
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  const headerToken = request.headers.get('x-cron-secret')

  return bearerToken === secret || headerToken === secret
}
