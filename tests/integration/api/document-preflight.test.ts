import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/documents/preflight/route'
import { preflightDocumentUpload } from '@/lib/server/document-preflight'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/document-preflight', () => ({
  preflightDocumentUpload: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const preflightDocumentUploadMock = vi.mocked(preflightDocumentUpload)

describe('documents preflight route', () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      context: {
        user: { id: 'user_123' } as never,
        supabase: {} as never,
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
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns a quote, current balance, conversion eligibility, and duplicate status', async () => {
    const response = await POST(
      jsonRequest(
        {
          filename: 'May Statement.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
          fileSha256: 'a'.repeat(64),
        },
        { 'x-request-id': 'req_preflight' },
      ) as never,
    )

    await expect(response.json()).resolves.toEqual({
      quote: { costCredits: 1 },
      currentBalance: 3,
      canConvert: true,
      duplicate: { isDuplicate: false },
      request_id: 'req_preflight',
      trace_id: '0123456789abcdef0123456789abcdef',
    })
    expect(response.status).toBe(200)
    expect(preflightDocumentUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user_123',
        filename: 'May_Statement.pdf',
        contentType: 'application/pdf',
        sizeBytes: 4096,
        fileSha256: 'a'.repeat(64),
        routeContext: expect.objectContaining({ requestId: 'req_preflight' }),
      }),
    )
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
    expect(preflightDocumentUploadMock).not.toHaveBeenCalled()
  })

  it('rejects array payloads before preflight lookup', async () => {
    const response = await POST(
      jsonRequest([
        {
          filename: 'statement.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
          fileSha256: 'a'.repeat(64),
        },
      ]) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 400,
      code: 'PRZM_VALIDATION_BATCH_UNSUPPORTED',
    })
    expect(preflightDocumentUploadMock).not.toHaveBeenCalled()
  })
})

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/v1/documents/preflight', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}
