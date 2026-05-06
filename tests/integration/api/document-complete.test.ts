import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { StartDocumentAnalysisCommand } from '@aws-sdk/client-textract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/documents/[documentId]/complete/route'
import {
  attachTextractJobToDocument,
  claimPendingDocumentUploadCompletion,
  getPendingDocumentForCompletion,
  markDocumentProcessingFailed,
} from '@/lib/server/document-processing'
import { rateLimit } from '@/lib/server/ratelimit'
import { requireWorkspaceWriterUser } from '@/lib/server/route-auth'
import { getKmsKeyId, getS3Client } from '@/lib/server/s3'
import { getTextractClient } from '@/lib/server/textract'

vi.mock('@/lib/server/route-auth', () => ({
  requireWorkspaceWriterUser: vi.fn(),
}))

vi.mock('@/lib/server/document-processing', () => ({
  attachTextractJobToDocument: vi.fn(),
  claimPendingDocumentUploadCompletion: vi.fn(),
  getPendingDocumentForCompletion: vi.fn(),
  markDocumentProcessingFailed: vi.fn(),
}))

vi.mock('@/lib/server/s3', () => ({
  getKmsKeyId: vi.fn(() => 'kms-test-key'),
  getS3Client: vi.fn(),
}))

vi.mock('@/lib/server/textract', () => ({
  getTextractClient: vi.fn(),
}))

vi.mock('@/lib/server/ratelimit', () => ({
  rateLimit: vi.fn(),
}))

const requireWorkspaceWriterUserMock = vi.mocked(requireWorkspaceWriterUser)
const attachTextractJobToDocumentMock = vi.mocked(attachTextractJobToDocument)
const claimPendingDocumentUploadCompletionMock = vi.mocked(claimPendingDocumentUploadCompletion)
const getPendingDocumentForCompletionMock = vi.mocked(getPendingDocumentForCompletion)
const markDocumentProcessingFailedMock = vi.mocked(markDocumentProcessingFailed)
const rateLimitMock = vi.mocked(rateLimit)
const getKmsKeyIdMock = vi.mocked(getKmsKeyId)
const getS3ClientMock = vi.mocked(getS3Client)
const getTextractClientMock = vi.mocked(getTextractClient)

describe('document upload completion route', () => {
  const sendS3 = vi.fn()
  const sendTextract = vi.fn()

  beforeEach(() => {
    requireWorkspaceWriterUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123' } as never,
        profile: { workspace_id: 'workspace_123', role: 'member' },
      },
    })
    getS3ClientMock.mockReturnValue({ send: sendS3 } as never)
    getTextractClientMock.mockReturnValue({ send: sendTextract } as never)
    getKmsKeyIdMock.mockReturnValue('kms-test-key')
    rateLimitMock.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      resetSeconds: 60,
    })
    getPendingDocumentForCompletionMock.mockResolvedValue({
      ok: true,
      document: {
        id: '00000000-0000-4000-8000-000000000123',
        s3Bucket: 'prizm-test-uploads',
        s3Key: 'user_123/00000000-0000-4000-8000-000000000123/statement.pdf',
        sizeBytes: 4096,
        contentType: 'application/pdf',
        status: 'pending',
      },
    })
    claimPendingDocumentUploadCompletionMock.mockResolvedValue({ ok: true })
    attachTextractJobToDocumentMock.mockResolvedValue({ ok: true })
    markDocumentProcessingFailedMock.mockResolvedValue({ ok: true })
    sendS3.mockResolvedValue({
      ContentLength: 4096,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: 'kms-test-key',
    })
    sendTextract.mockResolvedValue({ JobId: 'textract_job_123' })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid document IDs before authentication or provider work', async () => {
    const response = await POST(
      new Request('http://localhost/api/v1/documents/not-a-uuid/complete', {
        method: 'POST',
        headers: { 'x-request-id': 'req_complete_invalid_id' },
      }) as never,
      { params: Promise.resolve({ documentId: 'not-a-uuid' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 400,
      code: 'PRZM_VALIDATION_DOCUMENT_ID',
      request_id: 'req_complete_invalid_id',
    })
    expect(requireWorkspaceWriterUserMock).not.toHaveBeenCalled()
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(sendS3).not.toHaveBeenCalled()
  })

  it('verifies the uploaded object, starts Textract, and records processing state', async () => {
    const response = await POST(
      new Request(
        'http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/complete',
        {
          method: 'POST',
          headers: {
            'x-request-id': 'req_complete',
            'x-forwarded-for': '203.0.113.15',
            'user-agent': 'vitest',
          },
        },
      ) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    const body = await response.json()
    expect(response.status).toBe(202)
    expect(body).toMatchObject({
      documentId: '00000000-0000-4000-8000-000000000123',
      status: 'processing',
      textractJobId: 'textract_job_123',
      statusUrl: '/api/v1/documents/00000000-0000-4000-8000-000000000123/status',
      request_id: 'req_complete',
    })
    expect(sendS3).toHaveBeenCalledWith(expect.any(HeadObjectCommand))
    expect(sendTextract).toHaveBeenCalledWith(expect.any(StartDocumentAnalysisCommand))
    expect(getPendingDocumentForCompletionMock).toHaveBeenCalledWith({
      supabase: {},
      documentId: '00000000-0000-4000-8000-000000000123',
    })
    expect(claimPendingDocumentUploadCompletionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: '00000000-0000-4000-8000-000000000123',
        actorUserId: 'user_123',
        textractClientToken: '00000000000040008000000000000123',
        actorIp: '203.0.113.15',
        actorUserAgent: 'vitest',
        routeContext: expect.objectContaining({ requestId: 'req_complete' }),
      }),
    )
    expect(attachTextractJobToDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: '00000000-0000-4000-8000-000000000123',
        actorUserId: 'user_123',
        textractJobId: 'textract_job_123',
        routeContext: expect.objectContaining({ requestId: 'req_complete' }),
      }),
    )
    expect(claimPendingDocumentUploadCompletionMock.mock.invocationCallOrder[0]).toBeLessThan(
      sendTextract.mock.invocationCallOrder[0],
    )
    expect(sendTextract.mock.invocationCallOrder[0]).toBeLessThan(
      attachTextractJobToDocumentMock.mock.invocationCallOrder[0],
    )
  })

  it('fails closed before Textract when the uploaded object does not match presign metadata', async () => {
    sendS3.mockResolvedValue({
      ContentLength: 1024,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'aws:kms',
    })

    const response = await POST(
      new Request(
        'http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/complete',
        {
          method: 'POST',
          headers: { 'x-request-id': 'req_complete_bad_size' },
        },
      ) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 409,
      code: 'PRZM_UPLOAD_OBJECT_SIZE_MISMATCH',
      request_id: 'req_complete_bad_size',
    })
    expect(sendTextract).not.toHaveBeenCalled()
    expect(claimPendingDocumentUploadCompletionMock).not.toHaveBeenCalled()
    expect(attachTextractJobToDocumentMock).not.toHaveBeenCalled()
  })

  it('fails closed when the uploaded object uses a different KMS key', async () => {
    sendS3.mockResolvedValue({
      ContentLength: 4096,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: 'wrong-kms-key',
    })

    const response = await POST(
      new Request(
        'http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/complete',
        {
          method: 'POST',
          headers: { 'x-request-id': 'req_complete_bad_kms' },
        },
      ) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 409,
      code: 'PRZM_UPLOAD_OBJECT_KMS_KEY_MISMATCH',
      request_id: 'req_complete_bad_kms',
    })
    expect(sendTextract).not.toHaveBeenCalled()
    expect(claimPendingDocumentUploadCompletionMock).not.toHaveBeenCalled()
    expect(attachTextractJobToDocumentMock).not.toHaveBeenCalled()
  })

  it('fails closed when the expected upload KMS key is not configured', async () => {
    getKmsKeyIdMock.mockReturnValue(undefined)

    const response = await POST(
      new Request(
        'http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/complete',
        {
          method: 'POST',
          headers: { 'x-request-id': 'req_complete_missing_kms' },
        },
      ) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 500,
      code: 'PRZM_INTERNAL_UPLOAD_KMS_CONFIG',
      request_id: 'req_complete_missing_kms',
    })
    expect(sendTextract).not.toHaveBeenCalled()
    expect(claimPendingDocumentUploadCompletionMock).not.toHaveBeenCalled()
    expect(attachTextractJobToDocumentMock).not.toHaveBeenCalled()
  })

  it('replays an already-processing document without starting a duplicate Textract job', async () => {
    getPendingDocumentForCompletionMock.mockResolvedValue({
      ok: false,
      reason: 'not_pending',
      status: 'processing',
      textractJobId: 'textract_job_existing',
    })

    const response = await POST(
      new Request(
        'http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/complete',
        {
          method: 'POST',
          headers: { 'x-request-id': 'req_complete_replay' },
        },
      ) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      documentId: '00000000-0000-4000-8000-000000000123',
      status: 'processing',
      textractJobId: 'textract_job_existing',
      request_id: 'req_complete_replay',
    })
    expect(response.status).toBe(202)
    expect(sendS3).not.toHaveBeenCalled()
    expect(sendTextract).not.toHaveBeenCalled()
    expect(claimPendingDocumentUploadCompletionMock).not.toHaveBeenCalled()
    expect(attachTextractJobToDocumentMock).not.toHaveBeenCalled()
  })

  it('recovers a processing document that has no stored Textract job ID', async () => {
    getPendingDocumentForCompletionMock.mockResolvedValue({
      ok: true,
      document: {
        id: '00000000-0000-4000-8000-000000000123',
        s3Bucket: 'prizm-test-uploads',
        s3Key: 'user_123/00000000-0000-4000-8000-000000000123/statement.pdf',
        sizeBytes: 4096,
        contentType: 'application/pdf',
        status: 'processing',
      },
    })

    const response = await POST(
      new Request(
        'http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/complete',
        {
          method: 'POST',
          headers: { 'x-request-id': 'req_complete_recover' },
        },
      ) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      documentId: '00000000-0000-4000-8000-000000000123',
      status: 'processing',
      textractJobId: 'textract_job_123',
      request_id: 'req_complete_recover',
    })
    expect(response.status).toBe(202)
    expect(sendS3).toHaveBeenCalled()
    expect(sendTextract).toHaveBeenCalled()
    expect(claimPendingDocumentUploadCompletionMock).not.toHaveBeenCalled()
    expect(attachTextractJobToDocumentMock).toHaveBeenCalled()
  })

  it('marks the document failed when Textract cannot start after processing is claimed', async () => {
    sendTextract.mockRejectedValue(new Error('textract unavailable'))

    const response = await POST(
      new Request(
        'http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/complete',
        {
          method: 'POST',
          headers: { 'x-request-id': 'req_complete_textract_failed' },
        },
      ) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 502,
      code: 'PRZM_TEXTRACT_START_FAILED',
      request_id: 'req_complete_textract_failed',
    })
    expect(claimPendingDocumentUploadCompletionMock).toHaveBeenCalled()
    expect(markDocumentProcessingFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: '00000000-0000-4000-8000-000000000123',
        actorUserId: 'user_123',
        failureReason: 'textract_start_failed',
        textractJobId: null,
        routeContext: expect.objectContaining({ requestId: 'req_complete_textract_failed' }),
      }),
    )
    expect(attachTextractJobToDocumentMock).not.toHaveBeenCalled()
  })

  it('surfaces an evidence failure when Textract fails and failed-state write also fails', async () => {
    sendTextract.mockRejectedValue(new Error('textract unavailable'))
    markDocumentProcessingFailedMock.mockResolvedValue({ ok: false, reason: 'write_failed' })

    const response = await POST(
      new Request(
        'http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/complete',
        {
          method: 'POST',
          headers: { 'x-request-id': 'req_complete_failure_audit_failed' },
        },
      ) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 500,
      code: 'PRZM_INTERNAL_PROCESSING_FAILURE_WRITE_FAILED',
      request_id: 'req_complete_failure_audit_failed',
    })
    expect(markDocumentProcessingFailedMock).toHaveBeenCalled()
  })

  it('rate-limits upload completion before S3 or Textract calls', async () => {
    rateLimitMock.mockResolvedValue({
      success: false,
      limit: 60,
      remaining: 0,
      resetSeconds: 42,
    })

    const response = await POST(
      new Request(
        'http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/complete',
        {
          method: 'POST',
          headers: { 'x-request-id': 'req_complete_limited' },
        },
      ) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 429,
      code: 'PRZM_RATE_LIMIT_UPLOAD_COMPLETE',
      request_id: 'req_complete_limited',
    })
    expect(response.headers.get('retry-after')).toBe('42')
    expect(rateLimitMock).toHaveBeenCalledWith('document-complete:user_123', 60, 60)
    expect(sendS3).not.toHaveBeenCalled()
    expect(sendTextract).not.toHaveBeenCalled()
  })

  it('rejects read-only workspace users before S3 or Textract calls', async () => {
    requireWorkspaceWriterUserMock.mockResolvedValue({
      ok: false,
      problem: {
        status: 403,
        code: 'PRZM_AUTH_FORBIDDEN',
        title: 'Forbidden',
        detail: 'Owner, admin, or member access is required for this route.',
      },
    })

    const response = await POST(
      new Request(
        'http://localhost/api/v1/documents/00000000-0000-4000-8000-000000000123/complete',
        {
          method: 'POST',
          headers: { 'x-request-id': 'req_complete_forbidden' },
        },
      ) as never,
      { params: Promise.resolve({ documentId: '00000000-0000-4000-8000-000000000123' }) },
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 403,
      code: 'PRZM_AUTH_FORBIDDEN',
      request_id: 'req_complete_forbidden',
    })
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(sendS3).not.toHaveBeenCalled()
    expect(sendTextract).not.toHaveBeenCalled()
  })
})
