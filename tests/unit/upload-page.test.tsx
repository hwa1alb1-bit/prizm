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

  it('shows upload failed recovery when the browser PUT to S3 is rejected', async () => {
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
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)

    const { container } = render(<UploadPage />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    await userEvent.upload(
      input,
      new File(['statement'], 'May Statement.pdf', { type: 'application/pdf' }),
    )

    expect((await screen.findAllByText('Upload failed')).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/browser upload to secure storage returned HTTP 403/),
    ).toBeInTheDocument()
    expect(screen.getByText('doc_123')).toBeInTheDocument()
    expect(screen.getByText('req_presign')).toBeInTheDocument()
    expect(screen.getByText(/Upload the same PDF again/)).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('shows S3 verification recovery when completion cannot prove the uploaded object', async () => {
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
        problemResponse({
          status: 409,
          code: 'PRZM_DOCUMENT_UPLOAD_METADATA_MISMATCH',
          detail: 'The uploaded object size did not match the pending document.',
          request_id: 'req_complete',
          trace_id: 'fedcba9876543210fedcba9876543210',
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { container } = render(<UploadPage />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    await userEvent.upload(
      input,
      new File(['statement'], 'May Statement.pdf', { type: 'application/pdf' }),
    )

    expect((await screen.findAllByText('S3 verification failed')).length).toBeGreaterThan(0)
    expect(screen.getByText(/uploaded object size did not match/)).toBeInTheDocument()
    expect(screen.getByText('PRZM_DOCUMENT_UPLOAD_METADATA_MISMATCH')).toBeInTheDocument()
    expect(screen.getByText('req_complete')).toBeInTheDocument()
    expect(screen.getByText(/create a new verified object/)).toBeInTheDocument()
  })

  it('shows OCR start recovery when completion cannot start Textract', async () => {
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
        problemResponse({
          status: 502,
          code: 'PRZM_TEXTRACT_START_FAILED',
          detail: 'Textract could not start analysis for this PDF.',
          request_id: 'req_complete',
          trace_id: 'fedcba9876543210fedcba9876543210',
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { container } = render(<UploadPage />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    await userEvent.upload(
      input,
      new File(['statement'], 'May Statement.pdf', { type: 'application/pdf' }),
    )

    expect((await screen.findAllByText('OCR start failed')).length).toBeGreaterThan(0)
    expect(screen.getByText(/Textract could not start analysis/)).toBeInTheDocument()
    expect(screen.getByText('PRZM_TEXTRACT_START_FAILED')).toBeInTheDocument()
    expect(screen.getByText(/upload again if no retry action is available/)).toBeInTheDocument()
  })
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function problemResponse(body: {
  status: number
  code: string
  detail: string
  request_id: string
  trace_id: string
}): Response {
  return new Response(
    JSON.stringify({
      title: 'Problem',
      ...body,
    }),
    {
      status: body.status,
      headers: { 'content-type': 'application/problem+json' },
    },
  )
}
