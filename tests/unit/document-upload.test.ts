import { describe, expect, it, vi } from 'vitest'
import { createPendingDocumentUpload } from '@/lib/server/document-upload'
import { getServiceRoleClient } from '@/lib/server/supabase'

vi.mock('@/lib/server/supabase', () => ({
  getServiceRoleClient: vi.fn(),
}))

describe('createPendingDocumentUpload', () => {
  const baseInput = {
    actorUserId: 'user_123',
    filename: 'statement.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    fileSha256: 'f'.repeat(64),
    conversionCostCredits: 1,
    s3Bucket: 'uploads',
    s3Key: 'workspace/doc/statement.pdf',
    expiresAt: '2026-05-06T00:00:00.000Z',
    actorIp: '127.0.0.1',
    actorUserAgent: 'vitest',
    routeContext: {
      requestId: 'req_upload',
      traceId: '0123456789abcdef0123456789abcdef',
      pathname: '/api/v1/documents/presign',
    },
  }

  it('writes through the atomic document upload RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ document_id: 'doc_123', s3_key: 'workspace/doc/statement.pdf' }],
      error: null,
    })
    vi.mocked(getServiceRoleClient).mockReturnValue({ rpc } as never)

    const result = await createPendingDocumentUpload({
      ...baseInput,
    })

    expect(result).toEqual({
      ok: true,
      document: { id: 'doc_123', s3Key: 'workspace/doc/statement.pdf' },
    })
    expect(rpc).toHaveBeenCalledWith('create_pending_document_upload_for_actor', {
      p_actor_user_id: 'user_123',
      p_filename: 'statement.pdf',
      p_content_type: 'application/pdf',
      p_size_bytes: 1024,
      p_file_sha256: 'f'.repeat(64),
      p_conversion_cost_credits: 1,
      p_s3_bucket: 'uploads',
      p_s3_key: 'workspace/doc/statement.pdf',
      p_storage_provider: 's3',
      p_storage_bucket: 'uploads',
      p_storage_key: 'workspace/doc/statement.pdf',
      p_expires_at: '2026-05-06T00:00:00.000Z',
      p_request_id: 'req_upload',
      p_trace_id: '0123456789abcdef0123456789abcdef',
      p_actor_ip: '127.0.0.1',
      p_actor_user_agent: 'vitest',
    })
  })

  it('writes neutral R2 storage metadata while preserving S3 compatibility fields', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ document_id: 'doc_123', s3_key: 'workspace/doc/statement.pdf' }],
      error: null,
    })
    vi.mocked(getServiceRoleClient).mockReturnValue({ rpc } as never)

    const result = await createPendingDocumentUpload({
      ...baseInput,
      storageProvider: 'r2',
      storageBucket: 'prizm-r2-uploads',
      storageKey: 'workspace/doc/statement.pdf',
      s3Bucket: 'prizm-r2-uploads',
      s3Key: 'workspace/doc/statement.pdf',
    })

    expect(result).toEqual({
      ok: true,
      document: { id: 'doc_123', s3Key: 'workspace/doc/statement.pdf' },
    })
    expect(rpc).toHaveBeenCalledWith(
      'create_pending_document_upload_for_actor',
      expect.objectContaining({
        p_storage_provider: 'r2',
        p_storage_bucket: 'prizm-r2-uploads',
        p_storage_key: 'workspace/doc/statement.pdf',
        p_s3_bucket: 'prizm-r2-uploads',
        p_s3_key: 'workspace/doc/statement.pdf',
      }),
    )
  })

  it('maps workspace failures without leaking database details', async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'workspace_profile_not_found' },
      }),
    } as never)

    const result = await createPendingDocumentUpload({
      ...baseInput,
    })

    expect(result).toEqual({ ok: false, reason: 'no_workspace' })
  })
})
