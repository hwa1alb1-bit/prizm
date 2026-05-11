import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/documents/[documentId]/status/route'
import { getDocumentStatus } from '@/lib/server/document-status'
import { rateLimit } from '@/lib/server/ratelimit'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/document-status', () => ({
  getDocumentStatus: vi.fn(),
}))

vi.mock('@/lib/server/ratelimit', () => ({
  rateLimit: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const getDocumentStatusMock = vi.mocked(getDocumentStatus)
const rateLimitMock = vi.mocked(rateLimit)

describe('documents status route', () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      context: {
        user: { id: 'user_123' } as never,
        supabase: {} as never,
      },
    })
    getDocumentStatusMock.mockResolvedValue({
      ok: true,
      documentId: 'doc_123',
      state: 'processing',
      extractionEngine: 'textract',
      extractionJobId: 'textract_job_123',
      textractJobId: 'textract_job_123',
      chargeStatus: 'reserved',
      duplicate: { isDuplicate: false },
      retention: {
        expiresAt: '2026-05-08T00:00:00.000Z',
        deletedAt: null,
        deletionStatus: 'retained',
      },
      requestId: 'req_status',
      traceId: '0123456789abcdef0123456789abcdef',
    })
    rateLimitMock.mockResolvedValue({
      success: true,
      limit: 1200,
      remaining: 1199,
      resetSeconds: 60,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns document state, charge, duplicate, and retention status', async () => {
    const response = await GET(
      request({ 'x-request-id': 'req_status' }) as never,
      routeParams('doc_123'),
    )

    await expect(response.json()).resolves.toEqual({
      documentId: 'doc_123',
      state: 'processing',
      extractionEngine: 'textract',
      extractionJobId: 'textract_job_123',
      textractJobId: 'textract_job_123',
      chargeStatus: 'reserved',
      duplicate: { isDuplicate: false },
      retention: {
        expiresAt: '2026-05-08T00:00:00.000Z',
        deletedAt: null,
        deletionStatus: 'retained',
      },
      request_id: 'req_status',
      trace_id: '0123456789abcdef0123456789abcdef',
    })
    expect(response.status).toBe(200)
    expect(getDocumentStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        actorUserId: 'user_123',
        routeContext: expect.objectContaining({ requestId: 'req_status' }),
      }),
    )
  })

  it('rate-limits status polling before reading document state', async () => {
    rateLimitMock.mockResolvedValueOnce({
      success: false,
      limit: 1200,
      remaining: 0,
      resetSeconds: 12,
    })

    const response = await GET(request() as never, routeParams('doc_123'))

    await expect(response.json()).resolves.toMatchObject({
      status: 429,
      code: 'PRZM_RATE_LIMITED',
    })
    expect(response.headers.get('retry-after')).toBe('12')
    expect(rateLimitMock).toHaveBeenCalledWith('api:status:user_123', 1200, 60)
    expect(getDocumentStatusMock).not.toHaveBeenCalled()
  })
})

function request(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/v1/documents/doc_123/status', {
    method: 'GET',
    headers,
  })
}

function routeParams(documentId: string) {
  return {
    params: Promise.resolve({ documentId }),
  }
}
