import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/account/password/route'
import { changeAccountPassword } from '@/lib/server/account/password'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/account/password', () => ({
  changeAccountPassword: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const changeAccountPasswordMock = vi.mocked(changeAccountPassword)

function passwordRequest(body: unknown) {
  return new Request('http://localhost/api/v1/account/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/v1/account/password', () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123', email: 'owner@example.com' } as never,
      },
    })
    changeAccountPasswordMock.mockResolvedValue({ ok: true })
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

    const response = await POST(
      passwordRequest({ currentPassword: 'Hunter12345', newPassword: 'NewPass12345' }) as never,
    )

    expect(response.status).toBe(401)
    expect(changeAccountPasswordMock).not.toHaveBeenCalled()
  })

  it('returns 400 when fields are missing', async () => {
    const response = await POST(passwordRequest({ currentPassword: 'Hunter12345' }) as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'PRZM_VALIDATION_ACCOUNT_PASSWORD',
    })
    expect(changeAccountPasswordMock).not.toHaveBeenCalled()
  })

  it('returns 400 when the new password fails the policy', async () => {
    const response = await POST(
      passwordRequest({ currentPassword: 'Hunter12345', newPassword: 'weak' }) as never,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'PRZM_VALIDATION_ACCOUNT_PASSWORD_POLICY',
    })
    expect(changeAccountPasswordMock).not.toHaveBeenCalled()
  })

  it('returns 401 when the current password is wrong', async () => {
    changeAccountPasswordMock.mockResolvedValueOnce({ ok: false, reason: 'invalid_current' })

    const response = await POST(
      passwordRequest({ currentPassword: 'WrongPass1', newPassword: 'NewPass12345' }) as never,
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      code: 'PRZM_AUTH_INVALID_CURRENT_PASSWORD',
    })
  })

  it('returns 502 when the update fails for an unexpected reason', async () => {
    changeAccountPasswordMock.mockResolvedValueOnce({
      ok: false,
      reason: 'supabase down',
    })

    const response = await POST(
      passwordRequest({ currentPassword: 'Hunter12345', newPassword: 'NewPass12345' }) as never,
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      code: 'PRZM_INTERNAL_ACCOUNT_PASSWORD_CHANGE_FAILED',
    })
  })

  it('returns 200 on successful password change', async () => {
    const response = await POST(
      passwordRequest({ currentPassword: 'Hunter12345', newPassword: 'NewPass12345' }) as never,
    )

    expect(response.status).toBe(200)
    expect(changeAccountPasswordMock).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      email: 'owner@example.com',
      currentPassword: 'Hunter12345',
      newPassword: 'NewPass12345',
    })
  })
})
