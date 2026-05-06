import { NextResponse, type NextRequest } from 'next/server'
import { recordAuditEvent } from '@/lib/server/audit'
import {
  applyRouteHeaders,
  createRouteContext,
  getClientIp,
  problemResponse,
} from '@/lib/server/http'
import { getProviderLink, isProviderId, type ProviderLinkTarget } from '@/lib/server/ops/providers'
import { requireOpsAdminUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LINK_TARGETS = new Set<ProviderLinkTarget>(['console', 'billing', 'management'])

export async function GET(
  request: NextRequest,
  contextInput: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const context = createRouteContext(request)
  const { provider } = await contextInput.params

  if (!isProviderId(provider)) {
    return problemResponse(context, {
      status: 404,
      code: 'PRZM_OPS_PROVIDER_NOT_FOUND',
      title: 'Provider not found',
      detail: 'The requested provider is not configured for the Ops Dashboard.',
    })
  }

  const auth = await requireOpsAdminUser()
  if (!auth.ok) return problemResponse(context, auth.problem)

  const url = new URL(request.url)
  const target = parseTarget(url.searchParams.get('target'))
  const destination = getProviderLink(provider, target)
  const destinationHost = new URL(destination).host

  const audit = await recordAuditEvent({
    eventType: 'ops.quick_link_clicked',
    actorUserId: auth.context.user.id,
    targetType: 'ops_provider',
    metadata: {
      provider,
      target,
      destination_host: destinationHost,
      request_id: context.requestId,
      trace_id: context.traceId,
    },
    actorIp: getClientIp(request),
    actorUserAgent: request.headers.get('user-agent'),
  })

  if (!audit.ok) {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_AUDIT_WRITE_FAILED',
      title: 'Quick link could not be audited',
      detail:
        'The provider quick link was not opened because its audit event could not be recorded.',
    })
  }

  return applyRouteHeaders(context, NextResponse.redirect(destination, 302))
}

function parseTarget(value: string | null): ProviderLinkTarget {
  return value && LINK_TARGETS.has(value as ProviderLinkTarget)
    ? (value as ProviderLinkTarget)
    : 'console'
}
