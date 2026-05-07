import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/documents/[documentId]/status/route'
import { getDocumentStatus } from '@/lib/server/document-status'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/document-status', () => ({
  getDocumentStatus: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const getDocumentStatusMock = vi.mocked(getDocumentStatus)

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
