import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/documents/[documentId]/convert/route'
import { convertDocument } from '@/lib/server/document-conversion'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/document-conversion', () => ({
  convertDocument: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const convertDocumentMock = vi.mocked(convertDocument)

describe('documents convert route', () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      context: {
        user: { id: 'user_123' } as never,
        supabase: {} as never,
      },
    })
    convertDocumentMock.mockResolvedValue({
      ok: true,
      documentId: 'doc_123',
      status: 'processing',
      textractJobId: 'textract_job_123',
      chargeStatus: 'reserved',
      alreadyStarted: false,
      requestId: 'req_convert',
      traceId: '0123456789abcdef0123456789abcdef',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts conversion for a verified document and returns charge status', async () => {
    const response = await POST(
      request({ 'x-request-id': 'req_convert', 'x-forwarded-for': '203.0.113.10' }) as never,
      routeParams('doc_123'),
    )

    await expect(response.json()).resolves.toEqual({
      documentId: 'doc_123',
      status: 'processing',
      textractJobId: 'textract_job_123',
      chargeStatus: 'reserved',
      alreadyStarted: false,
      request_id: 'req_convert',
      trace_id: '0123456789abcdef0123456789abcdef',
    })
    expect(response.status).toBe(200)
    expect(convertDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        actorUserId: 'user_123',
        actorIp: '203.0.113.10',
        actorUserAgent: null,
        routeContext: expect.objectContaining({ requestId: 'req_convert' }),
      }),
    )
  })
})

function request(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/v1/documents/doc_123/convert', {
    method: 'POST',
    headers,
  })
}

function routeParams(documentId: string) {
  return {
    params: Promise.resolve({ documentId }),
  }
}
