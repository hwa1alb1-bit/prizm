import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/exports/[exportId]/download/route'
import { getStatementExportDownload } from '@/lib/server/statement-export'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/statement-export', () => ({
  getStatementExportDownload: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const getStatementExportDownloadMock = vi.mocked(getStatementExportDownload)

describe('export download route', () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123' } as never,
      },
    })
    getStatementExportDownloadMock.mockResolvedValue({
      ok: true,
      exportId: 'export_123',
      downloadUrl: 'https://signed.example/exports/export_123.csv',
      expiresInSeconds: 300,
      requestId: 'req_download',
      traceId: '0123456789abcdef0123456789abcdef',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns a short-lived signed URL for an authenticated export artifact', async () => {
    const response = await GET(
      request({ 'x-request-id': 'req_download', 'x-forwarded-for': '203.0.113.10' }) as never,
      routeParams('export_123'),
    )

    await expect(response.json()).resolves.toEqual({
      exportId: 'export_123',
      downloadUrl: 'https://signed.example/exports/export_123.csv',
      expiresInSeconds: 300,
      request_id: 'req_download',
      trace_id: '0123456789abcdef0123456789abcdef',
    })
    expect(response.status).toBe(200)
    expect(getStatementExportDownloadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        exportId: 'export_123',
        actorUserId: 'user_123',
        actorIp: '203.0.113.10',
        actorUserAgent: null,
        routeContext: expect.objectContaining({ requestId: 'req_download' }),
      }),
    )
  })
})

function request(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/v1/exports/export_123/download', {
    method: 'GET',
    headers,
  })
}

function routeParams(exportId: string) {
  return {
    params: Promise.resolve({ exportId }),
  }
}
