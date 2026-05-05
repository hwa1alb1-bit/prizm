import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/auth/callback/route'
import { createServerClient } from '@supabase/ssr'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

const createServerClientMock = vi.mocked(createServerClient)
const exchangeCodeForSession = vi.fn()

describe('auth callback route', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    createServerClientMock.mockReturnValue({
      auth: { exchangeCodeForSession },
    } as never)
    exchangeCodeForSession.mockResolvedValue({ error: null })
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
})
