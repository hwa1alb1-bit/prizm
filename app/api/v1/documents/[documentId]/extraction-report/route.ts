import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createExtractionReport } from '@/lib/server/extraction-report'
import { createRouteContext, getClientIp, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const extractionReportSchema = z
  .object({
    category: z.string().min(1).max(80),
    note: z.string().trim().min(1).max(2000).nullable().optional(),
    row: z
      .object({
        id: z.string().min(1).optional(),
        index: z.number().int().min(0).optional(),
        source: z.string().min(1).optional(),
      })
      .nullable()
      .optional(),
  })
  .refine((value) => Boolean(value.note) || Boolean(value.row), {
    message: 'Provide a note or row context.',
    path: ['note'],
  })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const context = createRouteContext(request)
  const auth = await requireAuthenticatedUser()
  if (!auth.ok) return problemResponse(context, auth.problem)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_INVALID_JSON',
      title: 'Invalid JSON',
      detail: 'The request body must be valid JSON.',
    })
  }

  const parsed = extractionReportSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_EXTRACTION_REPORT',
      title: 'Invalid extraction report',
      detail: parsed.error.issues[0]?.message ?? 'Invalid extraction report.',
    })
  }

  const { documentId } = await params
  const result = await createExtractionReport({
    documentId,
    actorUserId: auth.context.user.id,
    category: parsed.data.category,
    note: parsed.data.note ?? null,
    row: parsed.data.row ?? null,
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

  return jsonResponse(
    context,
    {
      reportId: result.reportId,
      documentId: result.documentId,
      statementId: result.statementId,
      request_id: result.requestId,
      trace_id: result.traceId,
    },
    { status: 201 },
  )
}
