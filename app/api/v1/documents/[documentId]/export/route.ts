import type { NextRequest } from 'next/server'
import {
  buildStatementExport,
  STATEMENT_EXPORT_FORMATS,
  type StatementExportFormat,
} from '@/lib/server/statement-export'
import { SIGN_CONVENTIONS, type SignConvention } from '@/lib/shared/sign-convention'
import { createRouteContext, getClientIp, problemResponse, routeHeaders } from '@/lib/server/http'
import { applyAuthenticatedRateLimit, withRateLimitHeaders } from '@/lib/server/route-rate-limit'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const context = createRouteContext(request)
  const auth = await requireAuthenticatedUser()
  if (!auth.ok) return problemResponse(context, auth.problem)

  const rateLimitDecision = await applyAuthenticatedRateLimit(
    context,
    'export',
    auth.context.user.id,
  )
  if (!rateLimitDecision.ok) return rateLimitDecision.response

  const url = new URL(request.url)
  const format = url.searchParams.get('format') ?? 'csv'
  if (!STATEMENT_EXPORT_FORMATS.includes(format as StatementExportFormat)) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_EXPORT_FORMAT',
      title: 'Invalid export format',
      detail: 'format must be csv, xlsx, quickbooks_csv, or xero_csv.',
    })
  }

  const signConventionParam = url.searchParams.get('signConvention')
  if (
    signConventionParam !== null &&
    !SIGN_CONVENTIONS.includes(signConventionParam as SignConvention)
  ) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_SIGN_CONVENTION',
      title: 'Invalid sign convention',
      detail: 'signConvention must be auto, bank, or credit_card.',
    })
  }

  const { documentId } = await params
  const result = await buildStatementExport({
    documentId,
    format: format as StatementExportFormat,
    actorUserId: auth.context.user.id,
    actorIp: getClientIp(request),
    actorUserAgent: request.headers.get('user-agent'),
    routeContext: context,
    signConvention: (signConventionParam ?? undefined) as SignConvention | undefined,
  })

  if (!result.ok) {
    return problemResponse(context, {
      status: result.status,
      code: result.code,
      title: result.title,
      detail: result.detail,
    })
  }

  const headers = routeHeaders(context, {
    'content-type': result.contentType,
    'content-disposition': `attachment; filename="${result.filename}"`,
  })
  const body =
    typeof result.body === 'string'
      ? result.body
      : new Blob([result.body.buffer as ArrayBuffer], { type: result.contentType })
  return withRateLimitHeaders(
    new Response(body, { status: 200, headers }),
    rateLimitDecision.result,
  )
}
