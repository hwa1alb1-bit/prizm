import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/ops/collect/[provider]/route'
import { requireOpsAdminUser } from '@/lib/server/route-auth'
import { collectOpsProviderSnapshots } from '@/lib/server/ops/collector'
import { rateLimit } from '@/lib/server/ratelimit'
import { recordAuditEvent } from '@/lib/server/audit'

vi.mock('@/lib/server/route-auth', () => ({
  requireOpsAdminUser: vi.fn(),
}))

vi.mock('@/lib/server/ops/collector', () => ({
  collectOpsProviderSnapshots: vi.fn(),
}))

vi.mock('@/lib/server/ratelimit', () => ({
  rateLimit: vi.fn(),
}))

vi.mock('@/lib/server/audit', () => ({
  recordAuditEvent: vi.fn(),
}))

const requireOpsAdminUserMock = vi.mocked(requireOpsAdminUser)
const collectOpsProviderSnapshotsMock = vi.mocked(collectOpsProviderSnapshots)
const rateLimitMock = vi.mocked(rateLimit)
const recordAuditEventMock = vi.mocked(recordAuditEvent)

describe('ops provider manual collection route', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('requires ops admin authorization before manual provider refresh', async () => {
    requireOpsAdminUserMock.mockResolvedValue({
      ok: false,
      problem: {
        status: 403,
        code: 'PRZM_AUTH_OPS_FORBIDDEN',
        title: 'Ops admin access required',
        detail: 'Owner or admin access is required for the Ops Dashboard.',
      },
    })

    const response = await POST(
      new Request('http://localhost/api/ops/collect/stripe', {
        method: 'POST',
        headers: { 'x-request-id': 'req_manual_denied' },
      }) as never,
      { params: Promise.resolve({ provider: 'stripe' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 403,
      code: 'PRZM_AUTH_OPS_FORBIDDEN',
      request_id: 'req_manual_denied',
    })
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(collectOpsProviderSnapshotsMock).not.toHaveBeenCalled()
  })

  it('rate-limits manual refresh per admin and provider', async () => {
    requireOpsAdminUserMock.mockResolvedValue(adminContext())
    rateLimitMock.mockResolvedValue({
      success: false,
      limit: 3,
      remaining: 0,
      resetSeconds: 60,
    })

    const response = await POST(
      new Request('http://localhost/api/ops/collect/stripe', {
        method: 'POST',
        headers: { 'x-request-id': 'req_manual_limited' },
      }) as never,
      { params: Promise.resolve({ provider: 'stripe' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 429,
      code: 'PRZM_RATE_LIMIT_OPS_REFRESH',
      request_id: 'req_manual_limited',
    })
    expect(response.headers.get('retry-after')).toBe('60')
    expect(response.headers.get('ratelimit-limit')).toBe('3')
    expect(response.headers.get('ratelimit-remaining')).toBe('0')
    expect(response.headers.get('x-ratelimit-limit')).toBe('3')
    expect(response.headers.get('x-ratelimit-remaining')).toBe('0')
    expect(rateLimitMock).toHaveBeenCalledWith('ops-refresh:user_admin:stripe', 3, 300)
    expect(collectOpsProviderSnapshotsMock).not.toHaveBeenCalled()
  })

  it('collects one provider and audits the manual refresh', async () => {
    requireOpsAdminUserMock.mockResolvedValue(adminContext())
    rateLimitMock.mockResolvedValue({
      success: true,
      limit: 3,
      remaining: 2,
      resetSeconds: 300,
    })
    recordAuditEventMock.mockResolvedValue({ ok: true, id: 'audit_refresh' })
    collectOpsProviderSnapshotsMock.mockResolvedValue({
      status: 'ok',
      providers: 1,
      metrics: 2,
      failures: [],
    })

    const response = await POST(
      new Request('http://localhost/api/ops/collect/stripe', {
        method: 'POST',
        headers: {
          'x-request-id': 'req_manual_refresh',
          'x-forwarded-for': '203.0.113.12',
          'user-agent': 'vitest',
        },
      }) as never,
      { params: Promise.resolve({ provider: 'stripe' }) },
    )

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('ratelimit-limit')).toBe('3')
    expect(response.headers.get('ratelimit-remaining')).toBe('2')
    expect(response.headers.get('x-ratelimit-limit')).toBe('3')
    expect(response.headers.get('x-ratelimit-remaining')).toBe('2')
    expect(body).toMatchObject({
      status: 'ok',
      providers: 1,
      metrics: 2,
      request_id: 'req_manual_refresh',
    })
    expect(recordAuditEventMock).toHaveBeenCalledWith({
      eventType: 'ops.provider_refresh_requested',
      actorUserId: 'user_admin',
      targetType: 'ops_provider',
      metadata: {
        provider: 'stripe',
        request_id: 'req_manual_refresh',
        trace_id: expect.any(String),
      },
      actorIp: '203.0.113.12',
      actorUserAgent: 'vitest',
    })
    expect(collectOpsProviderSnapshotsMock).toHaveBeenCalledWith({
      provider: 'stripe',
      trigger: 'manual',
    })
    expect(rateLimitMock).toHaveBeenCalledWith('ops-refresh:user_admin:stripe', 3, 300)
    expect(rateLimitMock).toHaveBeenCalledWith('ops-refresh:provider:stripe', 12, 300)
  })
})

function adminContext() {
  return {
    ok: true as const,
    context: {
      supabase: {} as never,
      user: { id: 'user_admin' } as never,
      opsAdmin: { role: 'admin' as const },
    },
  }
}
