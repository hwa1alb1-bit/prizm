import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/documents/[documentId]/extraction-report/route'
import { createExtractionReport } from '@/lib/server/extraction-report'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/extraction-report', () => ({
  createExtractionReport: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const createExtractionReportMock = vi.mocked(createExtractionReport)

describe('documents extraction report route', () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123' } as never,
      },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('requires a category plus either a note or row context', async () => {
    const response = await POST(jsonRequest({ category: 'wrong_amount' }) as never, routeParams())

    await expect(response.json()).resolves.toMatchObject({
      status: 400,
      code: 'PRZM_VALIDATION_EXTRACTION_REPORT',
    })
    expect(createExtractionReportMock).not.toHaveBeenCalled()
  })

  it('stores report context for the authenticated workspace', async () => {
    createExtractionReportMock.mockResolvedValue({
      ok: true,
      reportId: 'audit_report_123',
      documentId: 'doc_123',
      statementId: 'statement_123',
      requestId: 'req_report',
      traceId: '0123456789abcdef0123456789abcdef',
    })

    const response = await POST(
      jsonRequest({
        category: 'wrong_amount',
        note: 'Row total should be 49.95.',
        row: { id: 'txn_1', source: 'page_1_row_7' },
      }) as never,
      routeParams(),
    )

    await expect(response.json()).resolves.toMatchObject({
      reportId: 'audit_report_123',
      documentId: 'doc_123',
      statementId: 'statement_123',
    })
    expect(response.status).toBe(201)
    expect(createExtractionReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        actorUserId: 'user_123',
        category: 'wrong_amount',
        note: 'Row total should be 49.95.',
        row: { id: 'txn_1', source: 'page_1_row_7' },
      }),
    )
  })
})

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/documents/doc_123/extraction-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': 'req_report' },
    body: JSON.stringify(body),
  })
}

function routeParams() {
  return {
    params: Promise.resolve({ documentId: 'doc_123' }),
  }
}
