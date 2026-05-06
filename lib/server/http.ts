import { randomUUID } from 'node:crypto'

const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/i

export type RouteContext = {
  requestId: string
  traceId: string
  pathname: string
}

export type ProblemInit = {
  status: number
  code: string
  title: string
  detail: string
  type?: string
}

export type ProblemDocument = {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  code: string
  request_id: string
  trace_id: string
}

export function createRouteContext(request: Request): RouteContext {
  const url = new URL(request.url)
  return {
    requestId: normalizeRequestId(request.headers.get('x-request-id')) ?? randomUUID(),
    traceId:
      extractTraceId(request.headers.get('sentry-trace')) ?? randomUUID().replaceAll('-', ''),
    pathname: url.pathname,
  }
}

export function jsonResponse(
  context: RouteContext,
  body: Record<string, unknown>,
  init: ResponseInit = {},
): Response {
  return Response.json(body, {
    ...init,
    headers: routeHeaders(context, init.headers),
  })
}

export function problemResponse(context: RouteContext, problem: ProblemInit): Response {
  const body: ProblemDocument = {
    type: problem.type ?? `https://prizmview.app/errors/${problem.code}`,
    title: problem.title,
    status: problem.status,
    detail: problem.detail,
    instance: context.pathname,
    code: problem.code,
    request_id: context.requestId,
    trace_id: context.traceId,
  }
  const headers = routeHeaders(context)
  headers.set('Content-Type', 'application/problem+json')
  return new Response(JSON.stringify(body), { status: problem.status, headers })
}

export function applyRouteHeaders<T extends Response>(context: RouteContext, response: T): T {
  response.headers.set('X-Request-ID', context.requestId)
  response.headers.set('X-Sentry-Trace-ID', context.traceId)
  return response
}

export function routeHeaders(context: RouteContext, init?: HeadersInit): Headers {
  const headers = new Headers(init)
  headers.set('X-Request-ID', context.requestId)
  headers.set('X-Sentry-Trace-ID', context.traceId)
  return headers
}

export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const candidate = forwarded || request.headers.get('x-real-ip')?.trim()
  if (!candidate) return null
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(candidate)) return candidate
  if (/^[0-9a-f:]+$/i.test(candidate)) return candidate
  return null
}

function normalizeRequestId(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 128) return null
  if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) return null
  return trimmed
}

function extractTraceId(sentryTrace: string | null): string | null {
  if (!sentryTrace) return null
  const traceId = sentryTrace.split('-')[0]
  return TRACE_ID_PATTERN.test(traceId) ? traceId : null
}
