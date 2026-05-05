import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as publicHealth } from '@/app/api/health/route'
import { GET as opsHealth } from '@/app/api/ops/health/route'
import { collectHealthSnapshot } from '@/lib/server/health'
import { requireOwnerOrAdminUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/health', () => ({
  collectHealthSnapshot: vi.fn(),
}))

vi.mock('@/lib/server/route-auth', () => ({
  requireOwnerOrAdminUser: vi.fn(),
}))

const collectHealthSnapshotMock = vi.mocked(collectHealthSnapshot)
const requireOwnerOrAdminUserMock = vi.mocked(requireOwnerOrAdminUser)

describe('health routes', () => {
  beforeEach(() => {
    collectHealthSnapshotMock.mockResolvedValue({
      status: 'ok',
      httpStatus: 200,
      connectors: [{ name: 'supabase', ok: true, required: true }],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns sanitized public shallow health', async () => {
    const response = await publicHealth(
      new Request('http://localhost/api/health', {
        headers: { 'x-request-id': 'req_health' },
      }) as never,
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-request-id')).toBe('req_health')
    expect(body).toMatchObject({
      status: 'ok',
      mode: 'shallow',
      connectors: [{ name: 'supabase', ok: true, required: true }],
      request_id: 'req_health',
    })
    expect(JSON.stringify(body)).not.toContain('password')
    expect(collectHealthSnapshotMock).toHaveBeenCalledWith({
      deep: false,
      includeErrorCodes: false,
    })
  })

  it('rejects public deep health as a problem response', async () => {
    const response = await publicHealth(
      new Request('http://localhost/api/health?deep=true', {
        headers: { 'x-request-id': 'req_deep' },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 400,
      code: 'PRZM_VALIDATION_DEEP_HEALTH_NOT_PUBLIC',
      request_id: 'req_deep',
    })
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(collectHealthSnapshotMock).not.toHaveBeenCalled()
  })

  it('protects ops health before running deep checks', async () => {
    requireOwnerOrAdminUserMock.mockResolvedValue({
      ok: false,
      problem: {
        status: 401,
        code: 'PRZM_AUTH_UNAUTHORIZED',
        title: 'Authentication required',
        detail: 'Sign in before calling this route.',
      },
    })

    const response = await opsHealth(
      new Request('http://localhost/api/ops/health', {
        headers: { 'x-request-id': 'req_ops_denied' },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 401,
      code: 'PRZM_AUTH_UNAUTHORIZED',
      request_id: 'req_ops_denied',
    })
    expect(collectHealthSnapshotMock).not.toHaveBeenCalled()
  })

  it('runs protected deep health for owners and admins', async () => {
    requireOwnerOrAdminUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123' } as never,
        profile: { workspace_id: 'workspace_123', role: 'admin' },
      },
    })
    collectHealthSnapshotMock.mockResolvedValue({
      status: 'degraded',
      httpStatus: 503,
      connectors: [
        {
          name: 'stripe',
          ok: false,
          required: true,
          errorCode: 'configuration_missing',
        },
      ],
    })

    const response = await opsHealth(
      new Request('http://localhost/api/ops/health', {
        headers: { 'x-request-id': 'req_ops' },
      }) as never,
    )

    const body = await response.json()
    expect(response.status).toBe(503)
    expect(body).toMatchObject({
      status: 'degraded',
      mode: 'deep',
      connectors: [{ name: 'stripe', errorCode: 'configuration_missing' }],
      request_id: 'req_ops',
    })
    expect(collectHealthSnapshotMock).toHaveBeenCalledWith({
      deep: true,
      includeErrorCodes: true,
    })
  })
})
