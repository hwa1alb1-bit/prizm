import { afterEach, describe, expect, it, vi } from 'vitest'
import { pollDocumentStatus } from '@/lib/client/document-polling'

describe('pollDocumentStatus', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('backs off between non-terminal document states and stops on ready', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ state: 'processing' }))
      .mockResolvedValueOnce(jsonResponse({ state: 'ready' }))
    vi.stubGlobal('fetch', fetchMock)

    const poll = pollDocumentStatus('doc_123')
    await flushPromises()

    expect(statusCalls(fetchMock)).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(999)
    expect(statusCalls(fetchMock)).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1)

    await expect(poll).resolves.toBe('ready')
    expect(statusCalls(fetchMock)).toHaveLength(2)
  })
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function statusCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url]) => url === '/api/v1/documents/doc_123/status')
}
