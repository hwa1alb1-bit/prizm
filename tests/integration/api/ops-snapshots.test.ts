import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/ops/snapshots/route'
import { requireOpsAdminUser } from '@/lib/server/route-auth'
import { listLatestOpsSnapshots } from '@/lib/server/ops/store'
import { recordAuditEvent } from '@/lib/server/audit'

vi.mock('@/lib/server/route-auth', () => ({
  requireOpsAdminUser: vi.fn(),
}))

vi.mock('@/lib/server/ops/store', () => ({
  listLatestOpsSnapshots: vi.fn(),
}))

vi.mock('@/lib/server/audit', () => ({
  recordAuditEvent: vi.fn(),
}))

const requireOpsAdminUserMock = vi.mocked(requireOpsAdminUser)
const listLatestOpsSnapshotsMock = vi.mocked(listLatestOpsSnapshots)
const recordAuditEventMock = vi.mocked(recordAuditEvent)

describe('ops snapshots route', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('requires ops admin authorization before reading provider snapshots', async () => {
    requireOpsAdminUserMock.mockResolvedValue({
      ok: false,
      problem: {
        status: 403,
        code: 'PRZM_AUTH_OPS_FORBIDDEN',
        title: 'Ops admin access required',
        detail: 'Owner or admin access is required for the Ops Dashboard.',
      },
    })

    const response = await GET(
      new Request('http://localhost/api/ops/snapshots', {
        headers: { 'x-request-id': 'req_ops_denied' },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 403,
      code: 'PRZM_AUTH_OPS_FORBIDDEN',
      request_id: 'req_ops_denied',
    })
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(listLatestOpsSnapshotsMock).not.toHaveBeenCalled()
  })

  it('returns normalized snapshots for ops admins and records the dashboard read', async () => {
    requireOpsAdminUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_admin' } as never,
        opsAdmin: { role: 'admin' },
      },
    })
    listLatestOpsSnapshotsMock.mockResolvedValue([
      {
        provider: 'stripe',
        metric: 'credential_gap',
        displayName: 'Missing credential count',
        used: 0,
        limit: 1,
        unit: 'count',
        periodStart: null,
        periodEnd: null,
        status: 'green',
        freshness: 'fresh',
        sourceUrl: 'https://dashboard.stripe.com',
        collectedAt: '2026-05-05T23:00:00.000Z',
        errorCode: null,
      },
    ])
    recordAuditEventMock.mockResolvedValue({ ok: true, id: 'audit_123' })

    const response = await GET(
      new Request('http://localhost/api/ops/snapshots', {
        headers: {
          'x-request-id': 'req_ops_read',
          'x-forwarded-for': '203.0.113.9',
          'user-agent': 'vitest',
        },
      }) as never,
    )

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toMatchObject({
      snapshots: [
        {
          provider: 'stripe',
          metric: 'credential_gap',
          status: 'green',
          freshness: 'fresh',
        },
      ],
      request_id: 'req_ops_read',
    })
    expect(recordAuditEventMock).toHaveBeenCalledWith({
      eventType: 'ops.dashboard_read',
      actorUserId: 'user_admin',
      targetType: 'ops_dashboard',
      metadata: {
        route: '/api/ops/snapshots',
        request_id: 'req_ops_read',
        trace_id: expect.any(String),
      },
      actorIp: '203.0.113.9',
      actorUserAgent: 'vitest',
    })
  })
})
