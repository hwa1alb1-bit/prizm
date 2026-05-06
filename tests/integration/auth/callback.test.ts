import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/auth/callback/route'
import { createServerClient } from '@supabase/ssr'
import { recordAuditEvent } from '@/lib/server/audit'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/server/audit', () => ({
  recordAuditEvent: vi.fn(),
}))

const createServerClientMock = vi.mocked(createServerClient)
const exchangeCodeForSession = vi.fn()
const getUser = vi.fn()
const recordAuditEventMock = vi.mocked(recordAuditEvent)

describe('auth callback route', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    createServerClientMock.mockReturnValue({
      auth: { exchangeCodeForSession, getUser },
    } as never)
    exchangeCodeForSession.mockResolvedValue({ error: null })
    getUser.mockResolvedValue({ data: { user: { id: 'user_admin' } }, error: null })
    recordAuditEventMock.mockResolvedValue({ ok: true, id: 'audit_login' })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('exchanges the auth code and redirects to the requested app path', async () => {
    const response = await GET(
      new Request('http://localhost/auth/callback?code=abc&next=/app/history', {
        headers: { 'x-request-id': 'req_auth' },
      }) as never,
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/app/history')
    expect(response.headers.get('x-request-id')).toBe('req_auth')
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc')
  })

  it('redirects callback failures to login', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('invalid code') })

    const response = await GET(new Request('http://localhost/auth/callback?code=bad') as never)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/login?error=auth_callback_failed',
    )
  })

  it('records an ops admin login audit event when callback enters /ops', async () => {
    const response = await GET(
      new Request('http://localhost/auth/callback?code=abc&next=/ops', {
        headers: {
          'x-request-id': 'req_ops_login',
          'x-forwarded-for': '203.0.113.21',
          'user-agent': 'vitest',
        },
      }) as never,
    )

    expect(response.headers.get('location')).toBe('http://localhost/ops')
    expect(recordAuditEventMock).toHaveBeenCalledWith({
      eventType: 'ops.admin_login',
      actorUserId: 'user_admin',
      targetType: 'ops_dashboard',
      metadata: {
        route: '/ops',
        request_id: 'req_ops_login',
        trace_id: expect.any(String),
      },
      actorIp: '203.0.113.21',
      actorUserAgent: 'vitest',
    })
  })
})
