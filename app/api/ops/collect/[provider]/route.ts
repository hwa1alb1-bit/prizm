import type { NextRequest } from 'next/server'
import { recordAuditEvent } from '@/lib/server/audit'
import { createRouteContext, getClientIp, jsonResponse, problemResponse } from '@/lib/server/http'
import { collectOpsProviderSnapshots } from '@/lib/server/ops/collector'
import { isProviderId } from '@/lib/server/ops/providers'
import { rateLimit } from '@/lib/server/ratelimit'
import { requireOpsAdminUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
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

  const limit = await rateLimit(`ops-refresh:${auth.context.user.id}:${provider}`, 3, 300)
  if (!limit.success) {
    return rateLimitProblem(context, limit)
  }

  const providerLimit = await rateLimit(`ops-refresh:provider:${provider}`, 12, 300)
  if (!providerLimit.success) {
    return rateLimitProblem(context, providerLimit)
  }

  const audit = await recordAuditEvent({
    eventType: 'ops.provider_refresh_requested',
    actorUserId: auth.context.user.id,
    targetType: 'ops_provider',
    metadata: {
      provider,
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
      title: 'Provider refresh could not be audited',
      detail: 'The provider refresh was not started because its audit event could not be recorded.',
    })
  }

  const result = await collectOpsProviderSnapshots({ provider, trigger: 'manual' })

  return jsonResponse(
    context,
    {
      ...result,
      request_id: context.requestId,
      trace_id: context.traceId,
    },
    {
      status: result.status === 'failed' ? 500 : 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-RateLimit-Limit': String(limit.limit),
        'X-RateLimit-Remaining': String(limit.remaining),
      },
    },
  )
}

function rateLimitProblem(
  context: ReturnType<typeof createRouteContext>,
  limit: { limit: number; remaining: number; resetSeconds: number },
): Response {
  const response = problemResponse(context, {
    status: 429,
    code: 'PRZM_RATE_LIMIT_OPS_REFRESH',
    title: 'Manual refresh rate limit exceeded',
    detail: 'Wait before refreshing this provider again.',
  })
  response.headers.set('Retry-After', String(limit.resetSeconds))
  response.headers.set('X-RateLimit-Limit', String(limit.limit))
  response.headers.set('X-RateLimit-Remaining', String(limit.remaining))
  return response
}
