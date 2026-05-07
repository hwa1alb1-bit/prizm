import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/ops/evidence/access-review/route'
import { attestOpsAdminAccessReview } from '@/lib/server/evidence/soc2'
import { requireOpsAdminUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/evidence/soc2', () => ({
  attestOpsAdminAccessReview: vi.fn(),
}))

vi.mock('@/lib/server/route-auth', () => ({
  requireOpsAdminUser: vi.fn(),
}))

const attestOpsAdminAccessReviewMock = vi.mocked(attestOpsAdminAccessReview)
const requireOpsAdminUserMock = vi.mocked(requireOpsAdminUser)

describe('ops admin access review attestation route', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('requires ops admin authorization before attesting an access review', async () => {
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
      new Request('http://localhost/api/ops/evidence/access-review', {
        method: 'POST',
        headers: { 'x-request-id': 'req_access_review_denied' },
        body: JSON.stringify({ reviewId: 'review_123', status: 'approved' }),
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 403,
      code: 'PRZM_AUTH_OPS_FORBIDDEN',
      request_id: 'req_access_review_denied',
    })
    expect(attestOpsAdminAccessReviewMock).not.toHaveBeenCalled()
  })

  it('attests an access review and returns the auditable review status', async () => {
    requireOpsAdminUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_admin' } as never,
        opsAdmin: { role: 'admin' },
      },
    })
    attestOpsAdminAccessReviewMock.mockResolvedValue({
      reviewId: 'review_123',
      status: 'approved',
      reviewedAt: '2026-05-06T12:30:00.000Z',
    })

    const response = await POST(
      new Request('http://localhost/api/ops/evidence/access-review', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_access_review',
          'x-forwarded-for': '203.0.113.20',
          'user-agent': 'vitest',
        },
        body: JSON.stringify({
          reviewId: 'review_123',
          status: 'approved',
          note: 'All access still required.',
        }),
      }) as never,
    )

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      reviewId: 'review_123',
      status: 'approved',
      reviewedAt: '2026-05-06T12:30:00.000Z',
      request_id: 'req_access_review',
    })
    expect(attestOpsAdminAccessReviewMock).toHaveBeenCalledWith({
      reviewId: 'review_123',
      status: 'approved',
      note: 'All access still required.',
      reviewedBy: 'user_admin',
      routeContext: {
        requestId: 'req_access_review',
        traceId: expect.any(String),
        pathname: '/api/ops/evidence/access-review',
      },
      actorIp: '203.0.113.20',
      actorUserAgent: 'vitest',
    })
  })
})
