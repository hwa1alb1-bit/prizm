import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as requestAccountDeletion } from '@/app/api/v1/account/delete/route'
import { POST as requestDataExport } from '@/app/api/v1/account/data-export/route'
import { createPrivacyRequest } from '@/lib/server/privacy-requests'
import { rateLimit } from '@/lib/server/ratelimit'
import { requireOwnerOrAdminUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireOwnerOrAdminUser: vi.fn(),
}))

vi.mock('@/lib/server/privacy-requests', () => ({
  createPrivacyRequest: vi.fn(),
}))

vi.mock('@/lib/server/ratelimit', () => ({
  rateLimit: vi.fn(),
}))

const requireOwnerOrAdminUserMock = vi.mocked(requireOwnerOrAdminUser)
const createPrivacyRequestMock = vi.mocked(createPrivacyRequest)
const rateLimitMock = vi.mocked(rateLimit)

describe('privacy request routes', () => {
  beforeEach(() => {
    requireOwnerOrAdminUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123' } as never,
        profile: { workspace_id: 'workspace_123', role: 'owner' },
      },
    })
    createPrivacyRequestMock.mockResolvedValue({
      ok: true,
      request: {
        id: 'privacy_req_123',
        requestType: 'data_export',
        status: 'received',
        dueAt: '2026-06-05T00:00:00.000Z',
      },
    })
    rateLimitMock.mockResolvedValue({
      success: true,
      limit: 2,
      remaining: 1,
      resetSeconds: 86_400,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('accepts an audited data export request workflow for workspace owners and admins', async () => {
    const response = await requestDataExport(
      new Request('http://localhost/api/v1/account/data-export', {
        method: 'POST',
        headers: {
          'x-request-id': 'req_export',
          'x-forwarded-for': '203.0.113.25',
          'user-agent': 'vitest',
        },
      }) as never,
    )

    const body = await response.json()
    expect(response.status).toBe(202)
    expect(response.headers.get('ratelimit-limit')).toBe('2')
    expect(response.headers.get('ratelimit-remaining')).toBe('1')
    expect(response.headers.get('x-ratelimit-limit')).toBe('2')
    expect(response.headers.get('x-ratelimit-remaining')).toBe('1')
    expect(body).toMatchObject({
      status: 'received',
      requestType: 'data_export',
      requestId: 'privacy_req_123',
      dueBy: '2026-06-05T00:00:00.000Z',
      request_id: 'req_export',
    })
    expect(createPrivacyRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'data_export',
        auditEventType: 'privacy.data_export.requested',
        workspaceId: 'workspace_123',
        requestedBy: 'user_123',
        actorIp: '203.0.113.25',
        actorUserAgent: 'vitest',
        routeContext: expect.objectContaining({ requestId: 'req_export' }),
      }),
    )
    expect(rateLimitMock).toHaveBeenCalledWith('privacy:data_export:user_123', 2, 86_400)
  })

  it('accepts an audited account deletion request workflow for workspace owners and admins', async () => {
    createPrivacyRequestMock.mockResolvedValue({
      ok: true,
      request: {
        id: 'privacy_req_delete',
        requestType: 'account_deletion',
        status: 'received',
        dueAt: '2026-05-15T00:00:00.000Z',
      },
    })

    const response = await requestAccountDeletion(
      new Request('http://localhost/api/v1/account/delete', {
        method: 'POST',
        headers: {
          'x-request-id': 'req_delete_account',
          'x-forwarded-for': '203.0.113.30',
          'user-agent': 'vitest',
        },
      }) as never,
    )

    const body = await response.json()
    expect(response.status).toBe(202)
    expect(body).toMatchObject({
      status: 'received',
      requestType: 'account_deletion',
      requestId: 'privacy_req_delete',
      dueBy: '2026-05-15T00:00:00.000Z',
      request_id: 'req_delete_account',
    })
    expect(createPrivacyRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'account_deletion',
        auditEventType: 'privacy.account_deletion.requested',
        workspaceId: 'workspace_123',
        requestedBy: 'user_123',
        actorIp: '203.0.113.30',
        actorUserAgent: 'vitest',
        dueDays: 10,
        routeContext: expect.objectContaining({ requestId: 'req_delete_account' }),
      }),
    )
    expect(rateLimitMock).toHaveBeenCalledWith('privacy:account_deletion:user_123', 2, 86_400)
  })

  it('rejects unauthenticated data export requests before creating workflow state', async () => {
    requireOwnerOrAdminUserMock.mockResolvedValue({
      ok: false,
      problem: {
        status: 401,
        code: 'PRZM_AUTH_UNAUTHORIZED',
        title: 'Authentication required',
        detail: 'Sign in before calling this route.',
      },
    })

    const response = await requestDataExport(
      new Request('http://localhost/api/v1/account/data-export', {
        method: 'POST',
        headers: { 'x-request-id': 'req_export_denied' },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 401,
      code: 'PRZM_AUTH_UNAUTHORIZED',
      request_id: 'req_export_denied',
    })
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(createPrivacyRequestMock).not.toHaveBeenCalled()
  })

  it('rate-limits duplicate privacy workflow submissions before creating workflow state', async () => {
    rateLimitMock.mockResolvedValue({
      success: false,
      limit: 2,
      remaining: 0,
      resetSeconds: 120,
    })

    const response = await requestDataExport(
      new Request('http://localhost/api/v1/account/data-export', {
        method: 'POST',
        headers: { 'x-request-id': 'req_export_limited' },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 429,
      code: 'PRZM_RATE_LIMITED',
      request_id: 'req_export_limited',
    })
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(response.headers.get('retry-after')).toBe('120')
    expect(response.headers.get('ratelimit-limit')).toBe('2')
    expect(response.headers.get('ratelimit-remaining')).toBe('0')
    expect(response.headers.get('x-ratelimit-limit')).toBe('2')
    expect(response.headers.get('x-ratelimit-remaining')).toBe('0')
    expect(createPrivacyRequestMock).not.toHaveBeenCalled()
  })

  it('fails closed when privacy request workflow state cannot be recorded', async () => {
    createPrivacyRequestMock.mockResolvedValue({
      ok: false,
      reason: 'privacy_request_write_failed',
    })

    const response = await requestAccountDeletion(
      new Request('http://localhost/api/v1/account/delete', {
        method: 'POST',
        headers: { 'x-request-id': 'req_delete_write_failed' },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 500,
      code: 'PRZM_INTERNAL_PRIVACY_REQUEST_FAILED',
      request_id: 'req_delete_write_failed',
    })
  })
})
