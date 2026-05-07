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

  it('preflights with a client SHA-256, requires quote confirmation, then converts toward preview', async () => {
    mockSha256([0xab, 0xc1, 0x23])
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          quote: { costCredits: 1 },
          currentBalance: 10,
          canConvert: true,
          duplicate: { isDuplicate: false },
          request_id: 'req_preflight',
          trace_id: '0123456789abcdef0123456789abcdef',
        }),
      )
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
          status: 'verified',
          alreadyCompleted: false,
          request_id: 'req_complete',
          trace_id: '0123456789abcdef0123456789abcdef',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          documentId: 'doc_123',
          status: 'processing',
          textractJobId: 'textract_job_123',
          chargeStatus: 'reserved',
          alreadyStarted: false,
          request_id: 'req_convert',
          trace_id: '0123456789abcdef0123456789abcdef',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          documentId: 'doc_123',
          status: 'ready',
          request_id: 'req_status',
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

    expect(await screen.findByRole('button', { name: 'Confirm conversion' })).toBeInTheDocument()
    expect(screen.getByText('No duplicate found')).toBeInTheDocument()
    expect(screen.getByText('1 credit')).toBeInTheDocument()
    expect(screen.getByText('9 credits')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Confirm conversion' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6))
    expect(fetchMock.mock.calls[0]).toEqual([
      '/api/v1/documents/preflight',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          filename: 'May Statement.pdf',
          contentType: 'application/pdf',
          sizeBytes: 9,
          fileSha256: 'abc123',
        }),
      }),
    ])
    expect(fetchMock.mock.calls[1]).toEqual([
      '/api/v1/documents/presign',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          filename: 'May Statement.pdf',
          contentType: 'application/pdf',
          sizeBytes: 9,
          fileSha256: 'abc123',
          acceptedQuote: {
            costCredits: 1,
            fileSha256: 'abc123',
          },
        }),
      }),
    ])
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://s3.example/upload')
    expect(fetchMock.mock.calls[3]).toEqual([
      '/api/v1/documents/doc_123/complete',
      { method: 'POST' },
    ])
    expect(fetchMock.mock.calls[4]).toEqual([
      '/api/v1/documents/doc_123/convert',
      { method: 'POST' },
    ])
    expect(fetchMock.mock.calls[5]?.[0]).toBe('/api/v1/documents/doc_123/status')
    expect(await screen.findByText('Conversion started.')).toBeInTheDocument()
    expect(screen.getByText(/Textract job textract_job_123/)).toBeInTheDocument()
    expect(push).toHaveBeenCalledWith('/app/history/doc_123')
  })

  it('blocks confirmation when preflight says the PDF is not eligible to convert', async () => {
    mockSha256([0xab, 0xc1, 0x23])
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        quote: { costCredits: 1 },
        currentBalance: 0,
        canConvert: false,
        duplicate: { isDuplicate: true, existingDocumentId: 'doc_existing' },
        request_id: 'req_preflight',
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

    expect(await screen.findByText('Conversion blocked')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm conversion' })).not.toBeInTheDocument()
    expect(screen.getByText('Duplicate doc_existing')).toBeInTheDocument()
    expect(
      screen.getByText(/Resolve the duplicate or add credits before uploading/),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows upload failed recovery when the browser PUT to S3 is rejected', async () => {
    mockSha256([0xab, 0xc1, 0x23])
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(preflightResponse())
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

    await userEvent.click(await screen.findByRole('button', { name: 'Confirm conversion' }))

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
    mockSha256([0xab, 0xc1, 0x23])
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(preflightResponse())
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

    await userEvent.click(await screen.findByRole('button', { name: 'Confirm conversion' }))

    expect((await screen.findAllByText('S3 verification failed')).length).toBeGreaterThan(0)
    expect(screen.getByText(/uploaded object size did not match/)).toBeInTheDocument()
    expect(screen.getByText('PRZM_DOCUMENT_UPLOAD_METADATA_MISMATCH')).toBeInTheDocument()
    expect(screen.getByText('req_complete')).toBeInTheDocument()
    expect(screen.getByText(/create a new verified object/)).toBeInTheDocument()
  })

  it('shows OCR start recovery when completion cannot start Textract', async () => {
    mockSha256([0xab, 0xc1, 0x23])
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(preflightResponse())
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

    await userEvent.click(await screen.findByRole('button', { name: 'Confirm conversion' }))

    expect((await screen.findAllByText('OCR start failed')).length).toBeGreaterThan(0)
    expect(screen.getByText(/Textract could not start analysis/)).toBeInTheDocument()
    expect(screen.getByText('PRZM_TEXTRACT_START_FAILED')).toBeInTheDocument()
    expect(screen.getByText(/upload again if no retry action is available/)).toBeInTheDocument()
  })
})

function mockSha256(bytes: number[]) {
  const digest = vi.fn().mockResolvedValue(new Uint8Array(bytes).buffer)
  vi.stubGlobal('crypto', { subtle: { digest } })
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function preflightResponse(): Response {
  return jsonResponse({
    quote: { costCredits: 1 },
    currentBalance: 10,
    canConvert: true,
    duplicate: { isDuplicate: false },
    request_id: 'req_preflight',
    trace_id: '0123456789abcdef0123456789abcdef',
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
