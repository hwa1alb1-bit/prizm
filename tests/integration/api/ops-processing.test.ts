import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/ops/processing/route'
import { processTextractDocuments } from '@/lib/server/document-processing'

vi.mock('@/lib/server/document-processing', () => ({
  processTextractDocuments: vi.fn(),
}))

vi.mock('@/lib/shared/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/shared/env')>('@/lib/shared/env')
  return {
    ...actual,
    serverEnv: {
      ...actual.serverEnv,
      CRON_SECRET: 'cron_test_secret',
    },
  }
})

const processTextractDocumentsMock = vi.mocked(processTextractDocuments)

describe('processing ops route', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects processing polls without the cron secret', async () => {
    const response = await POST(
      new Request('http://localhost/api/ops/processing', {
        method: 'POST',
        headers: { 'x-request-id': 'req_processing_denied' },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 401,
      code: 'PRZM_AUTH_CRON_UNAUTHORIZED',
      request_id: 'req_processing_denied',
    })
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(processTextractDocumentsMock).not.toHaveBeenCalled()
  })

  it('polls Textract processing for valid cron requests', async () => {
    processTextractDocumentsMock.mockResolvedValue({
      status: 'ok',
      polled: 1,
      ready: 1,
      failed: 0,
      skipped: 0,
    })

    const response = await GET(
      new Request('http://localhost/api/ops/processing', {
        headers: {
          authorization: 'Bearer cron_test_secret',
          'x-request-id': 'req_processing_poll',
        },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      polled: 1,
      ready: 1,
      request_id: 'req_processing_poll',
    })
    expect(response.status).toBe(200)
    expect(processTextractDocumentsMock).toHaveBeenCalledWith({
      trigger: 'cron',
      routeContext: expect.objectContaining({ requestId: 'req_processing_poll' }),
    })
  })
})
