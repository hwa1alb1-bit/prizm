import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/account/email/route'
import { requestEmailChange } from '@/lib/server/account/email'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/account/email', () => ({
  requestEmailChange: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const requestEmailChangeMock = vi.mocked(requestEmailChange)

function emailRequest(body: unknown) {
  return new Request('http://localhost/api/v1/account/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/v1/account/email', () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123', email: 'old@example.com' } as never,
      },
    })
    requestEmailChangeMock.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: false,
      problem: {
        status: 401,
        code: 'PRZM_AUTH_UNAUTHORIZED',
        title: 'Authentication required',
        detail: 'Sign in before calling this route.',
      },
    })

    const response = await POST(emailRequest({ email: 'new@example.com' }) as never)

    expect(response.status).toBe(401)
    expect(requestEmailChangeMock).not.toHaveBeenCalled()
  })

  it('returns 400 when the email is malformed', async () => {
    const response = await POST(emailRequest({ email: 'not-an-email' }) as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'PRZM_VALIDATION_ACCOUNT_EMAIL',
    })
    expect(requestEmailChangeMock).not.toHaveBeenCalled()
  })

  it('returns 400 when the new email matches the current email', async () => {
    const response = await POST(emailRequest({ email: 'old@example.com' }) as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'PRZM_VALIDATION_ACCOUNT_EMAIL_UNCHANGED',
    })
    expect(requestEmailChangeMock).not.toHaveBeenCalled()
  })

  it('returns 200 with pendingEmail on success', async () => {
    const response = await POST(emailRequest({ email: 'NEW@example.com' }) as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ pending_email: 'new@example.com' })
    expect(requestEmailChangeMock).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      email: 'new@example.com',
    })
  })

  it('surfaces Supabase failures as 502', async () => {
    requestEmailChangeMock.mockResolvedValueOnce({
      ok: false,
      reason: 'Email rate limit exceeded',
    })

    const response = await POST(emailRequest({ email: 'new@example.com' }) as never)

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      code: 'PRZM_INTERNAL_ACCOUNT_EMAIL_CHANGE_FAILED',
    })
  })
})
