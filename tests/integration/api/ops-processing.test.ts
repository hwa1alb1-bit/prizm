import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/ops/processing/route'
import { processExtractionDocuments } from '@/lib/server/document-processing'

vi.mock('@/lib/server/document-processing', () => ({
  processExtractionDocuments: vi.fn(),
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

const processExtractionDocumentsMock = vi.mocked(processExtractionDocuments)

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
    expect(processExtractionDocumentsMock).not.toHaveBeenCalled()
  })

  it('polls extraction processing for valid cron requests', async () => {
    processExtractionDocumentsMock.mockResolvedValue({
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
    expect(processExtractionDocumentsMock).toHaveBeenCalledWith({
      trigger: 'cron',
      routeContext: expect.objectContaining({ requestId: 'req_processing_poll' }),
    })
  })

  it('targets one document for authorized manual processing requests', async () => {
    processExtractionDocumentsMock.mockResolvedValue({
      status: 'ok',
      polled: 1,
      ready: 0,
      failed: 0,
      skipped: 1,
    })

    const response = await POST(
      new Request('http://localhost/api/ops/processing?documentId=doc_manual_123', {
        method: 'POST',
        headers: {
          authorization: 'Bearer cron_test_secret',
          'x-request-id': 'req_processing_manual',
        },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      polled: 1,
      skipped: 1,
      request_id: 'req_processing_manual',
    })
    expect(response.status).toBe(200)
    expect(processExtractionDocumentsMock).toHaveBeenCalledWith({
      trigger: 'manual',
      limit: 1,
      documentId: 'doc_manual_123',
      routeContext: expect.objectContaining({ requestId: 'req_processing_manual' }),
    })
  })

  it('accepts a document id from an authorized JSON body', async () => {
    processExtractionDocumentsMock.mockResolvedValue({
      status: 'ok',
      polled: 1,
      ready: 1,
      failed: 0,
      skipped: 0,
    })

    const response = await POST(
      new Request('http://localhost/api/ops/processing', {
        method: 'POST',
        headers: {
          authorization: 'Bearer cron_test_secret',
          'content-type': 'application/json',
          'x-request-id': 'req_processing_body',
        },
        body: JSON.stringify({ documentId: 'doc_body_123' }),
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      ready: 1,
      request_id: 'req_processing_body',
    })
    expect(processExtractionDocumentsMock).toHaveBeenCalledWith({
      trigger: 'manual',
      limit: 1,
      documentId: 'doc_body_123',
      routeContext: expect.objectContaining({ requestId: 'req_processing_body' }),
    })
  })

  it('rejects malformed manual processing JSON without polling a batch', async () => {
    const response = await POST(
      new Request('http://localhost/api/ops/processing', {
        method: 'POST',
        headers: {
          authorization: 'Bearer cron_test_secret',
          'content-type': 'application/json',
          'x-request-id': 'req_processing_bad_body',
        },
        body: '{',
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 400,
      code: 'PRZM_OPS_PROCESSING_DOCUMENT_ID_INVALID',
      request_id: 'req_processing_bad_body',
    })
    expect(processExtractionDocumentsMock).not.toHaveBeenCalled()
  })

  it('rejects empty document ids without polling a batch', async () => {
    const response = await POST(
      new Request('http://localhost/api/ops/processing?documentId=', {
        method: 'POST',
        headers: {
          authorization: 'Bearer cron_test_secret',
          'x-request-id': 'req_processing_empty_doc',
        },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 400,
      code: 'PRZM_OPS_PROCESSING_DOCUMENT_ID_INVALID',
      request_id: 'req_processing_empty_doc',
    })
    expect(processExtractionDocumentsMock).not.toHaveBeenCalled()
  })
})
