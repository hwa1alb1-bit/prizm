import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/documents/[documentId]/complete/route'
import { completeDocumentUpload } from '@/lib/server/document-completion'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/document-completion', () => ({
  completeDocumentUpload: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const completeDocumentUploadMock = vi.mocked(completeDocumentUpload)

describe('documents complete route', () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123' } as never,
      },
    })
    completeDocumentUploadMock.mockResolvedValue({
      ok: true,
      documentId: 'doc_123',
      state: 'verified',
      alreadyCompleted: false,
      requestId: 'req_complete',
      traceId: '0123456789abcdef0123456789abcdef',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns an RFC 7807 response for unauthenticated users', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: false,
      problem: {
        status: 401,
        code: 'PRZM_AUTH_UNAUTHORIZED',
        title: 'Authentication required',
        detail: 'Sign in before calling this route.',
      },
    })

    const response = await POST(request() as never, routeParams('doc_123'))

    await expect(response.json()).resolves.toMatchObject({
      status: 401,
      code: 'PRZM_AUTH_UNAUTHORIZED',
    })
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(completeDocumentUploadMock).not.toHaveBeenCalled()
  })

  it('verifies the upload for the authenticated user without starting conversion', async () => {
    const response = await POST(
      request({ 'x-request-id': 'req_complete', 'x-forwarded-for': '203.0.113.10' }) as never,
      routeParams('doc_123'),
    )

    await expect(response.json()).resolves.toEqual({
      documentId: 'doc_123',
      status: 'verified',
      alreadyCompleted: false,
      request_id: 'req_complete',
      trace_id: '0123456789abcdef0123456789abcdef',
    })
    expect(response.status).toBe(200)
    expect(completeDocumentUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        actorUserId: 'user_123',
        actorIp: '203.0.113.10',
        actorUserAgent: null,
        routeContext: expect.objectContaining({ requestId: 'req_complete' }),
      }),
    )
  })

  it('returns a clean conflict when completion is repeated for a failed document', async () => {
    completeDocumentUploadMock.mockResolvedValue({
      ok: false,
      reason: 'conflict',
      status: 409,
      code: 'PRZM_DOCUMENT_COMPLETION_CONFLICT',
      title: 'Document cannot be completed',
      detail: 'Only pending uploads can be completed.',
    })

    const response = await POST(request() as never, routeParams('doc_failed'))

    await expect(response.json()).resolves.toMatchObject({
      status: 409,
      code: 'PRZM_DOCUMENT_COMPLETION_CONFLICT',
    })
  })
})

function request(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/v1/documents/doc_123/complete', {
    method: 'POST',
    headers,
  })
}

function routeParams(documentId: string) {
  return {
    params: Promise.resolve({ documentId }),
  }
}
