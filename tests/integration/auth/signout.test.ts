import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/auth/signout/route'
import { signOutFromCookies } from '@/lib/server/auth/signout'

vi.mock('@/lib/server/auth/signout', () => ({
  signOutFromCookies: vi.fn(),
}))

const signOutFromCookiesMock = vi.mocked(signOutFromCookies)

function signoutRequest() {
  return new Request('http://localhost/api/v1/auth/signout', { method: 'POST' })
}

describe('POST /api/v1/auth/signout', () => {
  beforeEach(() => {
    signOutFromCookiesMock.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 on a successful signout', async () => {
    const response = await POST(signoutRequest() as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true })
    expect(signOutFromCookiesMock).toHaveBeenCalled()
  })

  it('returns 200 even when already signed out (idempotent)', async () => {
    signOutFromCookiesMock.mockResolvedValueOnce({ ok: true })

    const response = await POST(signoutRequest() as never)

    expect(response.status).toBe(200)
  })

  it('returns 502 when the underlying signOut fails', async () => {
    signOutFromCookiesMock.mockResolvedValueOnce({ ok: false, reason: 'supabase down' })

    const response = await POST(signoutRequest() as never)

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      code: 'PRZM_INTERNAL_AUTH_SIGNOUT_FAILED',
    })
  })
})
