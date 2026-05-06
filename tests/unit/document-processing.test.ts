import { describe, expect, it, vi } from 'vitest'
import {
  attachTextractJobToDocument,
  claimPendingDocumentUploadCompletion,
  getPendingDocumentForCompletion,
  markDocumentProcessingFailed,
} from '@/lib/server/document-processing'
import { getServiceRoleClient } from '@/lib/server/supabase'

vi.mock('@/lib/server/supabase', () => ({
  getServiceRoleClient: vi.fn(),
}))

const getServiceRoleClientMock = vi.mocked(getServiceRoleClient)

describe('getPendingDocumentForCompletion', () => {
  it('returns pending document storage metadata through the user-scoped client', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: '00000000-0000-4000-8000-000000000123',
        s3_bucket: 'uploads',
        s3_key: 'user/doc/statement.pdf',
        size_bytes: 4096,
        content_type: 'application/pdf',
        status: 'pending',
        textract_job_id: null,
        deleted_at: null,
        expires_at: '2099-05-06T00:00:00.000Z',
      },
      error: null,
    })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ select }))

    const result = await getPendingDocumentForCompletion({
      supabase: { from } as never,
      documentId: '00000000-0000-4000-8000-000000000123',
    })

    expect(result).toEqual({
      ok: true,
      document: {
        id: '00000000-0000-4000-8000-000000000123',
        s3Bucket: 'uploads',
        s3Key: 'user/doc/statement.pdf',
        sizeBytes: 4096,
        contentType: 'application/pdf',
        status: 'pending',
      },
    })
    expect(from).toHaveBeenCalledWith('document')
    expect(select).toHaveBeenCalledWith(
      'id, s3_bucket, s3_key, size_bytes, content_type, status, textract_job_id, deleted_at, expires_at',
    )
    expect(eq).toHaveBeenCalledWith('id', '00000000-0000-4000-8000-000000000123')
  })

  it('rejects documents that already left the pending state', async () => {
    const result = await getPendingDocumentForCompletion({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: '00000000-0000-4000-8000-000000000123',
                  s3_bucket: 'uploads',
                  s3_key: 'user/doc/statement.pdf',
                  size_bytes: 4096,
                  content_type: 'application/pdf',
                  status: 'processing',
                  textract_job_id: 'textract_job_123',
                  deleted_at: null,
                  expires_at: '2099-05-06T00:00:00.000Z',
                },
                error: null,
              }),
            })),
          })),
        })),
      } as never,
      documentId: '00000000-0000-4000-8000-000000000123',
    })

    expect(result).toEqual({
      ok: false,
      reason: 'not_pending',
      status: 'processing',
      textractJobId: 'textract_job_123',
    })
  })

  it('returns processing documents without a job ID so upload completion can recover', async () => {
    const result = await getPendingDocumentForCompletion({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: '00000000-0000-4000-8000-000000000123',
                  s3_bucket: 'uploads',
                  s3_key: 'user/doc/statement.pdf',
                  size_bytes: 4096,
                  content_type: 'application/pdf',
                  status: 'processing',
                  textract_job_id: null,
                  deleted_at: null,
                  expires_at: '2099-05-06T00:00:00.000Z',
                },
                error: null,
              }),
            })),
          })),
        })),
      } as never,
      documentId: '00000000-0000-4000-8000-000000000123',
    })

    expect(result).toEqual({
      ok: true,
      document: {
        id: '00000000-0000-4000-8000-000000000123',
        s3Bucket: 'uploads',
        s3Key: 'user/doc/statement.pdf',
        sizeBytes: 4096,
        contentType: 'application/pdf',
        status: 'processing',
      },
    })
  })

  it('treats expired pending documents as unavailable before provider processing starts', async () => {
    const result = await getPendingDocumentForCompletion({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: '00000000-0000-4000-8000-000000000123',
                  s3_bucket: 'uploads',
                  s3_key: 'user/doc/statement.pdf',
                  size_bytes: 4096,
                  content_type: 'application/pdf',
                  status: 'pending',
                  textract_job_id: null,
                  deleted_at: null,
                  expires_at: '2020-01-01T00:00:00.000Z',
                },
                error: null,
              }),
            })),
          })),
        })),
      } as never,
      documentId: '00000000-0000-4000-8000-000000000123',
    })

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })
})

describe('claimPendingDocumentUploadCompletion', () => {
  const baseInput = {
    documentId: '00000000-0000-4000-8000-000000000123',
    actorUserId: 'user_123',
    textractClientToken: '00000000000040008000000000000123',
    actorIp: '203.0.113.15',
    actorUserAgent: 'vitest',
    routeContext: {
      requestId: 'req_complete',
      traceId: '0123456789abcdef0123456789abcdef',
      pathname: '/api/v1/documents/00000000-0000-4000-8000-000000000123/complete',
    },
  }

  it('writes through the atomic upload-complete RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    getServiceRoleClientMock.mockReturnValue({ rpc } as never)

    const result = await claimPendingDocumentUploadCompletion({
      ...baseInput,
    })

    expect(result).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('claim_pending_document_upload_completion', {
      p_document_id: '00000000-0000-4000-8000-000000000123',
      p_actor_user_id: 'user_123',
      p_textract_client_token: '00000000000040008000000000000123',
      p_request_id: 'req_complete',
      p_trace_id: '0123456789abcdef0123456789abcdef',
      p_actor_ip: '203.0.113.15',
      p_actor_user_agent: 'vitest',
    })
  })

  it('maps pending-state conflicts without leaking database details', async () => {
    getServiceRoleClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'document_not_pending' },
      }),
    } as never)

    const result = await claimPendingDocumentUploadCompletion({
      ...baseInput,
    })

    expect(result).toEqual({ ok: false, reason: 'not_pending' })
  })
})

describe('attachTextractJobToDocument', () => {
  it('records the provider job ID after Textract starts', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    getServiceRoleClientMock.mockReturnValue({ rpc } as never)

    const result = await attachTextractJobToDocument({
      documentId: '00000000-0000-4000-8000-000000000123',
      actorUserId: 'user_123',
      textractJobId: 'textract_job_123',
      routeContext: {
        requestId: 'req_complete',
        traceId: '0123456789abcdef0123456789abcdef',
        pathname: '/api/v1/documents/00000000-0000-4000-8000-000000000123/complete',
      },
    })

    expect(result).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('attach_document_textract_job', {
      p_document_id: '00000000-0000-4000-8000-000000000123',
      p_actor_user_id: 'user_123',
      p_textract_job_id: 'textract_job_123',
      p_request_id: 'req_complete',
      p_trace_id: '0123456789abcdef0123456789abcdef',
    })
  })
})

describe('markDocumentProcessingFailed', () => {
  it('records a durable failure state with audit metadata', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    getServiceRoleClientMock.mockReturnValue({ rpc } as never)

    const result = await markDocumentProcessingFailed({
      documentId: '00000000-0000-4000-8000-000000000123',
      actorUserId: 'user_123',
      failureReason: 'textract_start_failed',
      textractJobId: null,
      routeContext: {
        requestId: 'req_complete',
        traceId: '0123456789abcdef0123456789abcdef',
        pathname: '/api/v1/documents/00000000-0000-4000-8000-000000000123/complete',
      },
    })

    expect(result).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('mark_document_processing_failed', {
      p_document_id: '00000000-0000-4000-8000-000000000123',
      p_actor_user_id: 'user_123',
      p_failure_reason: 'textract_start_failed',
      p_textract_job_id: null,
      p_request_id: 'req_complete',
      p_trace_id: '0123456789abcdef0123456789abcdef',
    })
  })
})
