import { describe, expect, it } from 'vitest'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'

describe('route response helpers', () => {
  it('preserves request IDs and Sentry trace IDs', () => {
    const request = new Request('http://localhost/api/health', {
      headers: {
        'x-request-id': 'req_test_123',
        'sentry-trace': '0123456789abcdef0123456789abcdef-0123456789abcdef-1',
      },
    })

    const context = createRouteContext(request)

    expect(context).toMatchObject({
      requestId: 'req_test_123',
      traceId: '0123456789abcdef0123456789abcdef',
      pathname: '/api/health',
    })
  })

  it('returns RFC 7807 problem+json with trace headers', async () => {
    const context = createRouteContext(
      new Request('http://localhost/api/test', { headers: { 'x-request-id': 'req_problem' } }),
    )

    const response = problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_TEST',
      title: 'Invalid request',
      detail: 'The request is invalid.',
    })

    await expect(response.json()).resolves.toMatchObject({
      type: 'https://prizmview.app/errors/PRZM_VALIDATION_TEST',
      title: 'Invalid request',
      status: 400,
      detail: 'The request is invalid.',
      instance: '/api/test',
      code: 'PRZM_VALIDATION_TEST',
      request_id: 'req_problem',
    })
    expect(response.status).toBe(400)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-request-id')).toBe('req_problem')
    expect(response.headers.get('x-sentry-trace-id')).toMatch(/^[0-9a-f]{32}$/)
  })

  it('adds request and trace headers to JSON responses', () => {
    const context = createRouteContext(
      new Request('http://localhost/api/test', { headers: { 'x-request-id': 'req_json' } }),
    )
    const response = jsonResponse(context, { ok: true })

    expect(response.headers.get('x-request-id')).toBe('req_json')
    expect(response.headers.get('x-sentry-trace-id')).toMatch(/^[0-9a-f]{32}$/)
  })
})
