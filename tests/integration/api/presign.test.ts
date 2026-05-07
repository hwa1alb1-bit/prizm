import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/documents/presign/route'
import { getUploadBillingGate } from '@/lib/server/billing/access'
import { preflightDocumentUpload } from '@/lib/server/document-preflight'
import { createPendingDocumentUpload } from '@/lib/server/document-upload'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/document-upload', () => ({
  createPendingDocumentUpload: vi.fn(),
}))

vi.mock('@/lib/server/document-preflight', () => ({
  preflightDocumentUpload: vi.fn(),
}))

vi.mock('@/lib/server/billing/access', () => ({
  getUploadBillingGate: vi.fn(),
}))

vi.mock('@/lib/server/s3', () => ({
  getS3Client: vi.fn(() => ({})),
  getUploadBucket: vi.fn(() => 'prizm-test-uploads'),
  getKmsKeyId: vi.fn(() => 'kms-test-key'),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const preflightDocumentUploadMock = vi.mocked(preflightDocumentUpload)
const getUploadBillingGateMock = vi.mocked(getUploadBillingGate)
const createPendingDocumentUploadMock = vi.mocked(createPendingDocumentUpload)
const getSignedUrlMock = vi.mocked(getSignedUrl)

describe('documents presign route', () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123' } as never,
      },
    })
    preflightDocumentUploadMock.mockResolvedValue({
      ok: true,
      quote: { costCredits: 1 },
      currentBalance: 3,
      canConvert: true,
      duplicate: { isDuplicate: false },
      requestId: 'req_preflight',
      traceId: '0123456789abcdef0123456789abcdef',
    })
    getUploadBillingGateMock.mockResolvedValue({ allowed: true, mode: 'included_credit' })
    getSignedUrlMock.mockResolvedValue('https://s3.example/upload')
    createPendingDocumentUploadMock.mockResolvedValue({
      ok: true,
      document: { id: 'doc_123', s3Key: 'workspace/doc/statement.pdf' },
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

    const response = await POST(jsonRequest({}) as never)

    await expect(response.json()).resolves.toMatchObject({
      status: 401,
      code: 'PRZM_AUTH_UNAUTHORIZED',
    })
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(getSignedUrlMock).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON before creating upload state', async () => {
    const response = await POST(
      new Request('http://localhost/api/v1/documents/presign', {
        method: 'POST',
        body: '{',
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 400,
      code: 'PRZM_VALIDATION_INVALID_JSON',
    })
    expect(createPendingDocumentUploadMock).not.toHaveBeenCalled()
  })

  it('rejects invalid upload metadata', async () => {
    const response = await POST(
      jsonRequest({
        filename: 'statement.txt',
        contentType: 'text/plain',
        sizeBytes: 10,
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 400,
      code: 'PRZM_VALIDATION_UPLOAD_REQUEST',
    })
    expect(createPendingDocumentUploadMock).not.toHaveBeenCalled()
  })

  it('blocks presign before S3 signing when billing does not allow another upload', async () => {
    getUploadBillingGateMock.mockResolvedValue({
      allowed: false,
      reason: 'credits_exhausted',
      problemCode: 'PRZM_BILLING_CREDITS_EXHAUSTED',
      title: 'Conversion credits exhausted',
      detail: 'Upgrade or wait for the next billing period before starting another conversion.',
    })
    const fileSha256 = 'a'.repeat(64)

    const response = await POST(
      jsonRequest({
        filename: 'statement.pdf',
        contentType: 'application/pdf',
        sizeBytes: 4096,
        fileSha256,
        acceptedQuote: { costCredits: 1, fileSha256 },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 402,
      code: 'PRZM_BILLING_CREDITS_EXHAUSTED',
    })
    expect(preflightDocumentUploadMock).toHaveBeenCalled()
    expect(getSignedUrlMock).not.toHaveBeenCalled()
    expect(createPendingDocumentUploadMock).not.toHaveBeenCalled()
  })

  it('creates an audited pending document before returning the signed URL', async () => {
    const fileSha256 = 'b'.repeat(64)
    const response = await POST(
      jsonRequest(
        {
          filename: 'May Statement.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
          fileSha256,
          acceptedQuote: { costCredits: 1, fileSha256 },
        },
        { 'x-request-id': 'req_presign', 'x-forwarded-for': '203.0.113.10' },
      ) as never,
    )

    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body).toMatchObject({
      uploadUrl: 'https://s3.example/upload',
      documentId: 'doc_123',
      request_id: 'req_presign',
    })
    expect(createPendingDocumentUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'May_Statement.pdf',
        contentType: 'application/pdf',
        sizeBytes: 4096,
        fileSha256,
        conversionCostCredits: 1,
        s3Bucket: 'prizm-test-uploads',
        actorIp: '203.0.113.10',
        actorUserAgent: null,
        routeContext: expect.objectContaining({ requestId: 'req_presign' }),
      }),
    )
    expect(preflightDocumentUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user_123',
        fileSha256,
      }),
    )
    expect(getUploadBillingGateMock).toHaveBeenCalledWith({
      supabase: {},
      userId: 'user_123',
    })
  })

  it('rejects presign when preflight says the PDF cannot convert', async () => {
    preflightDocumentUploadMock.mockResolvedValue({
      ok: true,
      quote: { costCredits: 1 },
      currentBalance: 0,
      canConvert: false,
      duplicate: { isDuplicate: false },
      requestId: 'req_preflight',
      traceId: '0123456789abcdef0123456789abcdef',
    })
    const fileSha256 = 'f'.repeat(64)

    const response = await POST(
      jsonRequest({
        filename: 'statement.pdf',
        contentType: 'application/pdf',
        sizeBytes: 4096,
        fileSha256,
        acceptedQuote: { costCredits: 1, fileSha256 },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 402,
      code: 'PRZM_CREDITS_INSUFFICIENT',
    })
    expect(getUploadBillingGateMock).not.toHaveBeenCalled()
    expect(getSignedUrlMock).not.toHaveBeenCalled()
    expect(createPendingDocumentUploadMock).not.toHaveBeenCalled()
  })

  it('rejects an accepted quote when the top-level file hash does not match', async () => {
    const response = await POST(
      jsonRequest({
        filename: 'statement.pdf',
        contentType: 'application/pdf',
        sizeBytes: 4096,
        fileSha256: 'c'.repeat(64),
        acceptedQuote: { costCredits: 1, fileSha256: 'd'.repeat(64) },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 400,
      code: 'PRZM_VALIDATION_QUOTE_MISMATCH',
    })
    expect(createPendingDocumentUploadMock).not.toHaveBeenCalled()
  })

  it('fails closed when the audited write fails', async () => {
    createPendingDocumentUploadMock.mockResolvedValue({
      ok: false,
      reason: 'write_failed',
    })
    const fileSha256 = 'e'.repeat(64)

    const response = await POST(
      jsonRequest({
        filename: 'statement.pdf',
        contentType: 'application/pdf',
        sizeBytes: 4096,
        fileSha256,
        acceptedQuote: { costCredits: 1, fileSha256 },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 500,
      code: 'PRZM_INTERNAL_AUDITED_WRITE_FAILED',
    })
  })
})

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/v1/documents/presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}
