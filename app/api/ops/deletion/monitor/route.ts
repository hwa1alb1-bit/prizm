import type { NextRequest } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/server/cron-auth'
import { checkDeletionSurvivors } from '@/lib/server/deletion/runtime'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<Response> {
  return monitorFromAuthorizedRequest(request)
}

export async function GET(request: NextRequest): Promise<Response> {
  return monitorFromAuthorizedRequest(request)
}

async function monitorFromAuthorizedRequest(request: NextRequest): Promise<Response> {
  const context = createRouteContext(request)

  if (!isAuthorizedCronRequest(request)) {
    return problemResponse(context, {
      status: 401,
      code: 'PRZM_AUTH_CRON_UNAUTHORIZED',
      title: 'Cron authorization required',
      detail: 'A valid cron secret is required to monitor deletion survivors.',
    })
  }

  try {
    const result = await checkDeletionSurvivors({})
    return jsonResponse(
      context,
      {
        ...result,
        request_id: context.requestId,
        trace_id: context.traceId,
      },
      {
        status: result.status === 'red' ? 500 : 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_DELETION_MONITOR_FAILED',
      title: 'Deletion monitor failed',
      detail: 'Deletion survivor monitoring could not complete.',
    })
  }
}
