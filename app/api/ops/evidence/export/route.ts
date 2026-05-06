import type { NextRequest } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/server/cron-auth'
import { generateSoc2EvidenceExport } from '@/lib/server/evidence/soc2'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<Response> {
  return exportFromAuthorizedRequest(request)
}

export async function GET(request: NextRequest): Promise<Response> {
  return exportFromAuthorizedRequest(request)
}

async function exportFromAuthorizedRequest(request: NextRequest): Promise<Response> {
  const context = createRouteContext(request)

  if (!isAuthorizedCronRequest(request)) {
    return problemResponse(context, {
      status: 401,
      code: 'PRZM_AUTH_CRON_UNAUTHORIZED',
      title: 'Cron authorization required',
      detail: 'A valid cron secret is required to export SOC 2 evidence.',
    })
  }

  try {
    const result = await generateSoc2EvidenceExport({ trigger: 'cron' })
    return jsonResponse(
      context,
      {
        ...result,
        request_id: context.requestId,
        trace_id: context.traceId,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_SOC2_EVIDENCE_EXPORT_FAILED',
      title: 'SOC 2 evidence export failed',
      detail: 'The monthly SOC 2 evidence pack could not be generated.',
    })
  }
}
