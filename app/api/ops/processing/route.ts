import type { NextRequest } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/server/cron-auth'
import { processTextractDocuments } from '@/lib/server/document-processing'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<Response> {
  return processingFromAuthorizedRequest(request)
}

export async function GET(request: NextRequest): Promise<Response> {
  return processingFromAuthorizedRequest(request)
}

async function processingFromAuthorizedRequest(request: NextRequest): Promise<Response> {
  const context = createRouteContext(request)

  if (!isAuthorizedCronRequest(request)) {
    return problemResponse(context, {
      status: 401,
      code: 'PRZM_AUTH_CRON_UNAUTHORIZED',
      title: 'Cron authorization required',
      detail: 'A valid cron secret is required to poll document processing.',
    })
  }

  try {
    const result = await processTextractDocuments({
      trigger: 'cron',
      routeContext: context,
    })
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
  } catch {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_PROCESSING_POLL_FAILED',
      title: 'Processing poll failed',
      detail:
        'Document processing could not be polled. Failed documents will release reservations.',
    })
  }
}
