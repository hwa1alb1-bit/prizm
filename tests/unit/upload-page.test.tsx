import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import UploadPage from '@/app/(dashboard)/app/page'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

describe('UploadPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    push.mockReset()
  })

  it('calls complete after the S3 PUT and routes to the processing review record', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          uploadUrl: 'https://s3.example/upload',
          documentId: 'doc_123',
          request_id: 'req_presign',
          trace_id: '0123456789abcdef0123456789abcdef',
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        jsonResponse({
          documentId: 'doc_123',
          status: 'processing',
          textractJobId: 'textract_job_123',
          alreadyCompleted: false,
          request_id: 'req_complete',
          trace_id: '0123456789abcdef0123456789abcdef',
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { container } = render(<UploadPage />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    await userEvent.upload(
      input,
      new File(['statement'], 'May Statement.pdf', { type: 'application/pdf' }),
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/documents/presign')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://s3.example/upload')
    expect(fetchMock.mock.calls[2]).toEqual([
      '/api/v1/documents/doc_123/complete',
      { method: 'POST' },
    ])
    expect(await screen.findByText('Processing started.')).toBeInTheDocument()
    expect(screen.getByText(/Textract job textract_job_123/)).toBeInTheDocument()
    expect(push).toHaveBeenCalledWith('/app/history/doc_123')
  })
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
