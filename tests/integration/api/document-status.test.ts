import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/documents/[documentId]/status/route'
import { getDocumentProcessingStatus } from '@/lib/server/document-processing'
import { rateLimit } from '@/lib/server/ratelimit'
import { requireWorkspaceMemberUser } from '@/lib/server/route-auth'
import { getTextractDocumentStatus } from '@/lib/server/textract'

vi.mock('@/lib/server/route-auth', () => ({
  requireWorkspaceMemberUser: vi.fn(),
}))

vi.mock('@/lib/server/document-processing', () => ({
  getDocumentProcessingStatus: vi.fn(),
}))

vi.mock('@/lib/server/textract', () => ({
  getTextractDocumentStatus: vi.fn(),
}))

vi.mock('@/lib/server/ratelimit', () => ({
  rateLimit: vi.fn(),
}))

const requireWorkspaceMemberUserMock = vi.mocked(requireWorkspaceMemberUser)
const getDocumentProcessingStatusMock = vi.mocked(getDocumentProcessingStatus)
const getTextractDocumentStatusMock = vi.mocked(getTextractDocumentStatus)
const rateLimitMock = vi.mocked(rateLimit)

describe('document processing status route', () => {
  beforeEach(() => {
    requireWorkspaceMemberUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123' } as never,
        profile: { workspace_id: 'workspace_123', role: 'member' },
      },
    })
    getDocumentProcessingStatusMock.mockResolvedValue({
      ok: true,
      document: {
        id: '00000000-0000-4000-8000-000000000123',
        status: 'processing',
        textractJobId: 'textract_job_123',
        pages: null,
        failureReason: null,
      },
    })
    getTextractDocumentStatusMock.mockResolvedValue({
      ok: true,
      status: 'IN_PROGRESS',
    })
    rateLimitMock.mockResolvedValue({
      success: true,
      limit: 1200,
      remaining: 1199,
      resetSeconds: 60,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid document IDs before authentication or status reads', async () => {
    const response = await GET(
      new Request('http://localhost/api/v1/documents/not-a-uuid/status', {
        headers: { 'x-request-id': 'req_status_invalid_id' },
      }) as never,
      { params: Promise.resolve({ documentId: 'not-a-uuid' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 400,
      code: 'PRZM_VALIDATION_DOCUMENT_ID',
      request_id: 'req_status_invalid_id',
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(requireWorkspaceMemberUserMock).not.toHaveBeenCalled()
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(getDocumentProcessingStatusMock).not.toHaveBeenCalled()
  })

  it('returns DB status plus provider job status for a processing document', async () => {
    const response = await GET(
      new Request('http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/status', {
        headers: { 'x-request-id': 'req_status' },
      }) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toMatchObject({
      documentId: '00000000-0000-4000-8000-000000000123',
      status: 'processing',
      textract: {
        jobId: 'textract_job_123',
        status: 'IN_PROGRESS',
      },
      request_id: 'req_status',
    })
    expect(getDocumentProcessingStatusMock).toHaveBeenCalledWith({
      supabase: {},
      documentId: '00000000-0000-4000-8000-000000000123',
    })
    expect(getTextractDocumentStatusMock).toHaveBeenCalledWith('textract_job_123')
  })

  it('rate-limits status polling before document reads', async () => {
    rateLimitMock.mockResolvedValue({
      success: false,
      limit: 1200,
      remaining: 0,
      resetSeconds: 17,
    })

    const response = await GET(
      new Request('http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/status', {
        headers: { 'x-request-id': 'req_status_limited' },
      }) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 429,
      code: 'PRZM_RATE_LIMIT_STATUS_POLL',
      request_id: 'req_status_limited',
    })
    expect(response.headers.get('retry-after')).toBe('17')
    expect(rateLimitMock).toHaveBeenCalledWith('document-status:user_123', 1200, 60)
    expect(getDocumentProcessingStatusMock).not.toHaveBeenCalled()
    expect(getTextractDocumentStatusMock).not.toHaveBeenCalled()
  })

  it('allows workspace viewers to poll document status through the read route', async () => {
    requireWorkspaceMemberUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'viewer_123' } as never,
        profile: { workspace_id: 'workspace_123', role: 'viewer' },
      },
    })

    const response = await GET(
      new Request('http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/status', {
        headers: { 'x-request-id': 'req_status_forbidden' },
      }) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      documentId: '00000000-0000-4000-8000-000000000123',
      status: 'processing',
      request_id: 'req_status_forbidden',
    })
    expect(rateLimitMock).toHaveBeenCalledWith('document-status:viewer_123', 1200, 60)
    expect(getDocumentProcessingStatusMock).toHaveBeenCalled()
    expect(getTextractDocumentStatusMock).toHaveBeenCalledWith('textract_job_123')
  })

  it('does not call Textract for terminal document statuses', async () => {
    getDocumentProcessingStatusMock.mockResolvedValue({
      ok: true,
      document: {
        id: '00000000-0000-4000-8000-000000000123',
        status: 'failed',
        textractJobId: 'textract_job_123',
        pages: null,
        failureReason: 'textract_start_failed',
      },
    })

    const response = await GET(
      new Request('http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/status', {
        headers: { 'x-request-id': 'req_status_failed' },
      }) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      documentId: '00000000-0000-4000-8000-000000000123',
      status: 'failed',
      textract: null,
      failureReason: 'textract_start_failed',
      request_id: 'req_status_failed',
    })
    expect(getTextractDocumentStatusMock).not.toHaveBeenCalled()
  })
})
