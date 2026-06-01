import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/documents/[documentId]/export/route'
import { rateLimit } from '@/lib/server/ratelimit'
import { buildStatementExport } from '@/lib/server/statement-export'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/statement-export', () => ({
  STATEMENT_EXPORT_FORMATS: ['csv', 'xlsx', 'quickbooks_csv', 'xero_csv'],
  buildStatementExport: vi.fn(),
}))

vi.mock('@/lib/server/ratelimit', () => ({
  rateLimit: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const buildStatementExportMock = vi.mocked(buildStatementExport)
const rateLimitMock = vi.mocked(rateLimit)

describe('direct document export route', () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123' } as never,
      },
    })
    buildStatementExportMock.mockResolvedValue({
      ok: true,
      body: 'Date,Description,Debit,Credit,Amount,Balance\r\n',
      contentType: 'text/csv; charset=utf-8',
      filename: 'statement.csv',
      requestId: 'req_export',
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

  it('streams reviewed statement exports with rate-limit headers', async () => {
    const response = await GET(
      request({ 'x-request-id': 'req_export', 'x-forwarded-for': '203.0.113.10' }) as never,
      routeParams('doc_123'),
    )

    await expect(response.text()).resolves.toBe('Date,Description,Debit,Credit,Amount,Balance\r\n')
    expect(response.status).toBe(200)
    expect(response.headers.get('ratelimit-limit')).toBe('60')
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="statement.csv"')
    expect(buildStatementExportMock).toHaveBeenCalledWith(
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

  it.each([
    ['quickbooks_csv', 'statement.quickbooks-csv', 'text/csv; charset=utf-8'],
    ['xero_csv', 'statement.xero-csv', 'text/csv; charset=utf-8'],
    ['xlsx', 'statement.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ])(
    'dispatches format=%s to buildStatementExport and surfaces the matching filename',
    async (format, filename, contentType) => {
      buildStatementExportMock.mockResolvedValueOnce({
        ok: true,
        body: 'body',
        contentType,
        filename,
        requestId: 'req_export',
        traceId: '0123456789abcdef0123456789abcdef',
      })

      const response = await GET(request({}, format) as never, routeParams('doc_123'))

      expect(response.status).toBe(200)
      expect(response.headers.get('content-disposition')).toBe(`attachment; filename="${filename}"`)
      expect(response.headers.get('content-type')).toBe(contentType)
      expect(buildStatementExportMock).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: 'doc_123', format }),
      )
    },
  )

  it('rejects unknown export formats with a 400 before calling buildStatementExport', async () => {
    const response = await GET(request({}, 'pdf') as never, routeParams('doc_123'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      status: 400,
      code: 'PRZM_VALIDATION_EXPORT_FORMAT',
    })
    expect(buildStatementExportMock).not.toHaveBeenCalled()
  })

  it('rate-limits direct exports before generating files', async () => {
    rateLimitMock.mockResolvedValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      resetSeconds: 21,
    })

    const response = await GET(request() as never, routeParams('doc_123'))

    await expect(response.json()).resolves.toMatchObject({
      status: 429,
      code: 'PRZM_RATE_LIMITED',
    })
    expect(response.headers.get('retry-after')).toBe('21')
    expect(rateLimitMock).toHaveBeenCalledWith('api:export:user_123', 60, 60)
    expect(buildStatementExportMock).not.toHaveBeenCalled()
  })
})

function request(headers: Record<string, string> = {}, format = 'csv'): Request {
  return new Request(`http://localhost/api/v1/documents/doc_123/export?format=${format}`, {
    method: 'GET',
    headers,
  })
}

function routeParams(documentId: string) {
  return {
    params: Promise.resolve({ documentId }),
  }
}
