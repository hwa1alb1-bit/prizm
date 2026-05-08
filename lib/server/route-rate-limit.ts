import 'server-only'

import type { RouteContext } from './http'
import { problemResponse } from './http'
import { rateLimit, type RateLimitResult } from './ratelimit'
import { captureException } from './sentry'

export const ROUTE_RATE_LIMITS = {
  upload: {
    key: 'upload',
    label: 'Upload and conversion requests',
    limit: 60,
    windowSec: 60,
  },
  status: {
    key: 'status',
    label: 'Document status polling',
    limit: 1200,
    windowSec: 60,
  },
  billing: {
    key: 'billing',
    label: 'Billing session creation',
    limit: 60,
    windowSec: 60,
  },
  export: {
    key: 'export',
    label: 'Export creation',
    limit: 60,
    windowSec: 60,
  },
  exportDownload: {
    key: 'export-download',
    label: 'Export download URL requests',
    limit: 600,
    windowSec: 60,
  },
} as const

export type RouteRateLimitPolicy = keyof typeof ROUTE_RATE_LIMITS

type RateLimitDecision =
  | { ok: true; result: RateLimitResult | null }
  | { ok: false; response: Response }

export async function applyAuthenticatedRateLimit(
  context: RouteContext,
  policyName: RouteRateLimitPolicy,
  userId: string,
): Promise<RateLimitDecision> {
  const policy = ROUTE_RATE_LIMITS[policyName]

  let result: RateLimitResult
  try {
    result = await rateLimit(`api:${policy.key}:${userId}`, policy.limit, policy.windowSec)
  } catch (err) {
    captureException(err, {
      route: context.pathname,
      rateLimitPolicy: policyName,
    })
    return { ok: true, result: null }
  }

  if (result.success) {
    return { ok: true, result }
  }

  const response = problemResponse(context, {
    status: 429,
    code: 'PRZM_RATE_LIMITED',
    title: 'Rate limit exceeded',
    detail: `${policy.label} are temporarily limited. Retry after the reset window.`,
  })

  return { ok: false, response: withRateLimitHeaders(response, result, true) }
}

export function withRateLimitHeaders<T extends Response>(
  response: T,
  result: RateLimitResult | null,
  includeRetryAfter = false,
): T {
  if (!result) return response

  response.headers.set('RateLimit-Limit', String(result.limit))
  response.headers.set('RateLimit-Remaining', String(result.remaining))
  response.headers.set('RateLimit-Reset', String(result.resetSeconds))
  response.headers.set('X-RateLimit-Limit', String(result.limit))
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  response.headers.set('X-RateLimit-Reset', String(result.resetSeconds))

  if (includeRetryAfter) {
    response.headers.set('Retry-After', String(result.resetSeconds))
  }

  return response
}
