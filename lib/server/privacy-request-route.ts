import 'server-only'

import { createRouteContext, getClientIp, jsonResponse, problemResponse } from './http'
import { createPrivacyRequest, type PrivacyRequestType } from './privacy-requests'
import { rateLimit, type RateLimitResult } from './ratelimit'
import { withRateLimitHeaders } from './route-rate-limit'
import { requireOwnerOrAdminUser } from './route-auth'
import { captureException } from './sentry'

const PRIVACY_REQUEST_LIMIT = 2
const PRIVACY_REQUEST_WINDOW_SECONDS = 86_400

type PrivacyRequestRouteConfig = {
  requestType: PrivacyRequestType
  auditEventType: string
  failureSubject: string
  dueDays?: number
}

export async function handlePrivacyRequestRoute(
  req: Request,
  config: PrivacyRequestRouteConfig,
): Promise<Response> {
  const context = createRouteContext(req)
  const auth = await requireOwnerOrAdminUser()

  if (!auth.ok) return problemResponse(context, auth.problem)

  const privacyRateLimit = await safePrivacyRateLimit(
    context.pathname,
    config.requestType,
    auth.context.user.id,
  )

  if (privacyRateLimit && !privacyRateLimit.success) {
    return withRateLimitHeaders(
      problemResponse(context, {
        status: 429,
        code: 'PRZM_RATE_LIMITED',
        title: 'Rate limit exceeded',
        detail: `Too many ${config.failureSubject} requests were submitted. Retry after the reset window.`,
      }),
      privacyRateLimit,
      true,
    )
  }

  const actorIp = getClientIp(req)
  const actorUserAgent = req.headers.get('user-agent')
  const privacyRequest = await createPrivacyRequest({
    requestType: config.requestType,
    auditEventType: config.auditEventType,
    workspaceId: auth.context.profile.workspace_id,
    requestedBy: auth.context.user.id,
    actorIp,
    actorUserAgent,
    routeContext: context,
    dueDays: config.dueDays,
  })

  if (!privacyRequest.ok) {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_PRIVACY_REQUEST_FAILED',
      title: 'Privacy request could not be recorded',
      detail: `The ${config.failureSubject} request was not accepted because it could not be recorded.`,
    })
  }

  return withRateLimitHeaders(
    jsonResponse(
      context,
      {
        status: privacyRequest.request.status,
        requestType: privacyRequest.request.requestType,
        requestId: privacyRequest.request.id,
        dueBy: privacyRequest.request.dueAt,
        request_id: context.requestId,
        trace_id: context.traceId,
      },
      { status: 202 },
    ),
    privacyRateLimit,
    false,
  )
}

async function safePrivacyRateLimit(
  pathname: string,
  requestType: PrivacyRequestType,
  userId: string,
): Promise<RateLimitResult | null> {
  try {
    return await rateLimit(
      `privacy:${requestType}:${userId}`,
      PRIVACY_REQUEST_LIMIT,
      PRIVACY_REQUEST_WINDOW_SECONDS,
    )
  } catch (err) {
    captureException(err, {
      route: pathname,
      rateLimitPolicy: 'privacy',
      requestType,
    })
    return null
  }
}
