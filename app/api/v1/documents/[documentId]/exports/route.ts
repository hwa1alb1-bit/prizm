import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createStatementExportArtifact } from '@/lib/server/statement-export'
import { createRouteContext, getClientIp, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const exportRequestSchema = z.object({
  format: z.literal('csv').optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const context = createRouteContext(request)
  const auth = await requireAuthenticatedUser()
  if (!auth.ok) return problemResponse(context, auth.problem)

  let body: unknown = {}
  try {
    const text = await request.text()
    body = text ? JSON.parse(text) : {}
  } catch {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_INVALID_JSON',
      title: 'Invalid JSON',
      detail: 'The request body must be valid JSON.',
    })
  }

  const parsed = exportRequestSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_EXPORT_FORMAT',
      title: 'Invalid export format',
      detail: 'Only csv exports can be created from this endpoint.',
    })
  }

  const { documentId } = await params
  const result = await createStatementExportArtifact({
    documentId,
    format: parsed.data.format ?? 'csv',
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

  return jsonResponse(
    context,
    {
      exportId: result.exportId,
      documentId: result.documentId,
      format: result.format,
      filename: result.filename,
      contentType: result.contentType,
      expiresAt: result.expiresAt,
      downloadPath: `/api/v1/exports/${result.exportId}/download`,
      request_id: result.requestId,
      trace_id: result.traceId,
    },
    { status: 201 },
  )
}
