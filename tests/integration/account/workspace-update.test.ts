import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from '@/app/api/v1/account/workspace/route'
import { updateWorkspaceName } from '@/lib/server/account/workspace'
import { requireOwnerOrAdminUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireOwnerOrAdminUser: vi.fn(),
}))

vi.mock('@/lib/server/account/workspace', () => ({
  updateWorkspaceName: vi.fn(),
}))

const requireOwnerOrAdminUserMock = vi.mocked(requireOwnerOrAdminUser)
const updateWorkspaceNameMock = vi.mocked(updateWorkspaceName)

function workspaceRequest(body: unknown) {
  return new Request('http://localhost/api/v1/account/workspace', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/v1/account/workspace', () => {
  beforeEach(() => {
    requireOwnerOrAdminUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123', email: 'owner@example.com' } as never,
        profile: { workspace_id: 'workspace_123', role: 'owner' },
      },
    })
    updateWorkspaceNameMock.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for members and viewers', async () => {
    requireOwnerOrAdminUserMock.mockResolvedValue({
      ok: false,
      problem: {
        status: 403,
        code: 'PRZM_AUTH_FORBIDDEN',
        title: 'Forbidden',
        detail: 'Owner or admin access is required for this route.',
      },
    })

    const response = await PATCH(workspaceRequest({ name: 'New name' }) as never)

    expect(response.status).toBe(403)
    expect(updateWorkspaceNameMock).not.toHaveBeenCalled()
  })

  it('returns 400 when name is missing', async () => {
    const response = await PATCH(workspaceRequest({}) as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'PRZM_VALIDATION_ACCOUNT_WORKSPACE',
    })
    expect(updateWorkspaceNameMock).not.toHaveBeenCalled()
  })

  it('returns 400 when name is blank after trim', async () => {
    const response = await PATCH(workspaceRequest({ name: '   ' }) as never)

    expect(response.status).toBe(400)
    expect(updateWorkspaceNameMock).not.toHaveBeenCalled()
  })

  it('returns 200 with the trimmed name on success', async () => {
    const response = await PATCH(workspaceRequest({ name: '  Benchmark  ' }) as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ name: 'Benchmark' })
    expect(updateWorkspaceNameMock).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      workspaceId: 'workspace_123',
      name: 'Benchmark',
    })
  })

  it('returns 500 when the helper fails', async () => {
    updateWorkspaceNameMock.mockResolvedValueOnce({ ok: false, reason: 'db' })

    const response = await PATCH(workspaceRequest({ name: 'Benchmark' }) as never)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      code: 'PRZM_INTERNAL_ACCOUNT_WORKSPACE_UPDATE_FAILED',
    })
  })
})
