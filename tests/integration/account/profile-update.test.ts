import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from '@/app/api/v1/account/profile/route'
import { updateUserProfile } from '@/lib/server/account/profile'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/account/profile', () => ({
  updateUserProfile: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const updateUserProfileMock = vi.mocked(updateUserProfile)

function profileRequest(body: unknown) {
  return new Request('http://localhost/api/v1/account/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/v1/account/profile', () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123', email: 'owner@example.com' } as never,
      },
    })
    updateUserProfileMock.mockResolvedValue({ ok: true })
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

    const response = await PATCH(profileRequest({ full_name: 'Hank' }) as never)

    expect(response.status).toBe(401)
    expect(updateUserProfileMock).not.toHaveBeenCalled()
  })

  it('returns 400 when full_name is missing', async () => {
    const response = await PATCH(profileRequest({}) as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'PRZM_VALIDATION_ACCOUNT_PROFILE',
    })
    expect(updateUserProfileMock).not.toHaveBeenCalled()
  })

  it('returns 400 when full_name is an empty string', async () => {
    const response = await PATCH(profileRequest({ full_name: '   ' }) as never)

    expect(response.status).toBe(400)
    expect(updateUserProfileMock).not.toHaveBeenCalled()
  })

  it('returns 400 when full_name exceeds 120 characters', async () => {
    const response = await PATCH(profileRequest({ full_name: 'x'.repeat(121) }) as never)

    expect(response.status).toBe(400)
    expect(updateUserProfileMock).not.toHaveBeenCalled()
  })

  it('updates the profile and returns the new full_name on success', async () => {
    const response = await PATCH(profileRequest({ full_name: '  Hank Alberts  ' }) as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ full_name: 'Hank Alberts' })
    expect(updateUserProfileMock).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      userId: 'user_123',
      fullName: 'Hank Alberts',
    })
  })

  it('returns 500 when the update helper fails', async () => {
    updateUserProfileMock.mockResolvedValueOnce({ ok: false, reason: 'db_error' })

    const response = await PATCH(profileRequest({ full_name: 'Hank' }) as never)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      code: 'PRZM_INTERNAL_ACCOUNT_PROFILE_UPDATE_FAILED',
    })
  })

  it('returns 400 when the JSON body is malformed', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/v1/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }) as never,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'PRZM_VALIDATION_INVALID_JSON' })
  })
})
