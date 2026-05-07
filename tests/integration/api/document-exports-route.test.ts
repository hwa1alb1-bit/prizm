import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/documents/[documentId]/exports/route'
import { createStatementExportArtifact } from '@/lib/server/statement-export'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/statement-export', () => ({
  createStatementExportArtifact: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const createStatementExportArtifactMock = vi.mocked(createStatementExportArtifact)

describe('document exports route', () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123' } as never,
      },
    })
    createStatementExportArtifactMock.mockResolvedValue({
      ok: true,
      exportId: 'export_123',
      documentId: 'doc_123',
      format: 'csv',
      filename: 'statement.csv',
      contentType: 'text/csv; charset=utf-8',
      expiresAt: '2026-05-08T12:00:00.000Z',
      requestId: 'req_export',
      traceId: '0123456789abcdef0123456789abcdef',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a CSV export artifact for an authenticated ready document', async () => {
    const response = await POST(
      request(
        { format: 'csv' },
        { 'x-request-id': 'req_export', 'x-forwarded-for': '203.0.113.10' },
      ) as never,
      routeParams('doc_123'),
    )

    await expect(response.json()).resolves.toEqual({
      exportId: 'export_123',
      documentId: 'doc_123',
      format: 'csv',
      filename: 'statement.csv',
      contentType: 'text/csv; charset=utf-8',
      expiresAt: '2026-05-08T12:00:00.000Z',
      downloadPath: '/api/v1/exports/export_123/download',
      request_id: 'req_export',
      trace_id: '0123456789abcdef0123456789abcdef',
    })
    expect(response.status).toBe(201)
    expect(createStatementExportArtifactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        format: 'csv',
        actorUserId: 'user_123',
        actorIp: '203.0.113.10',
        actorUserAgent: null,
        routeContext: expect.objectContaining({ requestId: 'req_export' }),
      }),
    )
  })
})

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/v1/documents/doc_123/exports', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function routeParams(documentId: string) {
  return {
    params: Promise.resolve({ documentId }),
  }
}
