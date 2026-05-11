import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/documents/[documentId]/convert/route'
import { convertDocument } from '@/lib/server/document-conversion'
import { rateLimit } from '@/lib/server/ratelimit'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/document-conversion', () => ({
  convertDocument: vi.fn(),
}))

vi.mock('@/lib/server/ratelimit', () => ({
  rateLimit: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const convertDocumentMock = vi.mocked(convertDocument)
const rateLimitMock = vi.mocked(rateLimit)

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
      extractionEngine: 'textract',
      extractionJobId: 'textract_job_123',
      textractJobId: 'textract_job_123',
      chargeStatus: 'reserved',
      alreadyStarted: false,
      requestId: 'req_convert',
      traceId: '0123456789abcdef0123456789abcdef',
    })
    rateLimitMock.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      resetSeconds: 60,
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
      extractionEngine: 'textract',
      extractionJobId: 'textract_job_123',
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

  it('keeps the v1 textractJobId response alias when the selected engine is the Kotlin worker', async () => {
    convertDocumentMock.mockResolvedValueOnce({
      ok: true,
      documentId: 'doc_123',
      status: 'processing',
      extractionEngine: 'kotlin_worker',
      extractionJobId: 'worker_job_123',
      textractJobId: 'worker_job_123',
      chargeStatus: 'reserved',
      alreadyStarted: false,
      requestId: 'req_convert',
      traceId: '0123456789abcdef0123456789abcdef',
    })

    const response = await POST(
      request({ 'x-request-id': 'req_convert', 'x-forwarded-for': '203.0.113.10' }) as never,
      routeParams('doc_123'),
    )

    await expect(response.json()).resolves.toEqual({
      documentId: 'doc_123',
      status: 'processing',
      extractionEngine: 'kotlin_worker',
      extractionJobId: 'worker_job_123',
      textractJobId: 'worker_job_123',
      chargeStatus: 'reserved',
      alreadyStarted: false,
      request_id: 'req_convert',
      trace_id: '0123456789abcdef0123456789abcdef',
    })
    expect(response.status).toBe(200)
  })

  it('rate-limits conversion starts before reserving credits or starting Textract', async () => {
    rateLimitMock.mockResolvedValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      resetSeconds: 50,
    })

    const response = await POST(request() as never, routeParams('doc_123'))

    await expect(response.json()).resolves.toMatchObject({
      status: 429,
      code: 'PRZM_RATE_LIMITED',
    })
    expect(response.headers.get('retry-after')).toBe('50')
    expect(rateLimitMock).toHaveBeenCalledWith('api:upload:user_123', 60, 60)
    expect(convertDocumentMock).not.toHaveBeenCalled()
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
