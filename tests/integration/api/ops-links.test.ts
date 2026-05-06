import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/ops/links/[provider]/route'
import { requireOpsAdminUser } from '@/lib/server/route-auth'
import { recordAuditEvent } from '@/lib/server/audit'

vi.mock('@/lib/server/route-auth', () => ({
  requireOpsAdminUser: vi.fn(),
}))

vi.mock('@/lib/server/audit', () => ({
  recordAuditEvent: vi.fn(),
}))

const requireOpsAdminUserMock = vi.mocked(requireOpsAdminUser)
const recordAuditEventMock = vi.mocked(recordAuditEvent)

describe('ops provider quick links', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('requires ops admin authorization before redirecting to a provider console', async () => {
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
      new Request('http://localhost/api/ops/links/stripe?target=billing', {
        headers: { 'x-request-id': 'req_link_denied' },
      }) as never,
      { params: Promise.resolve({ provider: 'stripe' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 403,
      code: 'PRZM_AUTH_OPS_FORBIDDEN',
      request_id: 'req_link_denied',
    })
    expect(recordAuditEventMock).not.toHaveBeenCalled()
  })

  it('audits and redirects allowed quick-link clicks', async () => {
    requireOpsAdminUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_admin' } as never,
        opsAdmin: { role: 'admin' },
      },
    })
    recordAuditEventMock.mockResolvedValue({ ok: true, id: 'audit_link' })

    const response = await GET(
      new Request('http://localhost/api/ops/links/stripe?target=billing', {
        headers: {
          'x-request-id': 'req_link',
          'x-forwarded-for': '203.0.113.14',
          'user-agent': 'vitest',
        },
      }) as never,
      { params: Promise.resolve({ provider: 'stripe' }) },
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://dashboard.stripe.com/settings/billing')
    expect(response.headers.get('x-request-id')).toBe('req_link')
    expect(recordAuditEventMock).toHaveBeenCalledWith({
      eventType: 'ops.quick_link_clicked',
      actorUserId: 'user_admin',
      targetType: 'ops_provider',
      metadata: {
        provider: 'stripe',
        target: 'billing',
        destination_host: 'dashboard.stripe.com',
        request_id: 'req_link',
        trace_id: expect.any(String),
      },
      actorIp: '203.0.113.14',
      actorUserAgent: 'vitest',
    })
  })
})
