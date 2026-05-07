import type { NextRequest } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/server/cron-auth'
import { runDeletionSweep } from '@/lib/server/deletion/runtime'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<Response> {
  return sweepFromAuthorizedRequest(request)
}

export async function GET(request: NextRequest): Promise<Response> {
  return sweepFromAuthorizedRequest(request)
}

async function sweepFromAuthorizedRequest(request: NextRequest): Promise<Response> {
  const context = createRouteContext(request)

  if (!isAuthorizedCronRequest(request)) {
    return problemResponse(context, {
      status: 401,
      code: 'PRZM_AUTH_CRON_UNAUTHORIZED',
      title: 'Cron authorization required',
      detail: 'A valid cron secret is required to sweep expired documents.',
    })
  }

  try {
    const result = await runDeletionSweep({ trigger: 'cron' })
    return jsonResponse(
      context,
      {
        ...result,
        request_id: context.requestId,
        trace_id: context.traceId,
      },
      {
        status: result.status === 'ok' ? 200 : 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_DELETION_SWEEP_FAILED',
      title: 'Deletion sweep failed',
      detail:
        'Expired document deletion could not be completed. The monitor will page if survivors remain.',
    })
  }
}
