import { describe, expect, it, vi } from 'vitest'
import {
  completeDocumentUpload,
  type CompletionDocument,
  type DocumentCompletionDependencies,
} from '@/lib/server/document-completion'

describe('completeDocumentUpload', () => {
  it('forbids completion when the document belongs to a different workspace', async () => {
    const deps = createDependencies({
      document: documentRow({ workspaceId: 'workspace_other' }),
    })

    const result = await completeDocumentUpload(completionInput(), deps)

    expect(result).toMatchObject({
      ok: false,
      reason: 'forbidden',
      status: 403,
    })
    expect(deps.headObject).not.toHaveBeenCalled()
    expect(deps.startTextractAnalysis).not.toHaveBeenCalled()
  })

  it('fails closed and marks the document failed when the S3 object is missing', async () => {
    const deps = createDependencies()
    deps.headObject.mockRejectedValueOnce(notFoundError())

    const result = await completeDocumentUpload(completionInput(), deps)

    expect(result).toMatchObject({
      ok: false,
      reason: 's3_object_missing',
      status: 409,
    })
    expect(deps.markProcessingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        failureReason: 'S3 object was not found for the pending upload.',
        eventType: 'document.processing_failed',
      }),
    )
    expect(deps.startTextractAnalysis).not.toHaveBeenCalled()
  })

  it('fails closed and records a failed state when S3 metadata does not match the document row', async () => {
    const deps = createDependencies()
    deps.headObject.mockResolvedValueOnce({
      contentLength: 2048,
      contentType: 'application/pdf',
      serverSideEncryption: 'aws:kms',
    })

    const result = await completeDocumentUpload(completionInput(), deps)

    expect(result).toMatchObject({
      ok: false,
      reason: 's3_metadata_mismatch',
      status: 409,
    })
    expect(deps.markProcessingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        failureReason: 'S3 object metadata did not match the pending upload record: size_bytes.',
      }),
    )
    expect(deps.markUploadCompleted).not.toHaveBeenCalled()
  })

  it('transitions pending uploads to processing, writes audit events, and stores Textract job evidence', async () => {
    const deps = createDependencies()

    const result = await completeDocumentUpload(completionInput(), deps)

    expect(result).toEqual({
      ok: true,
      documentId: 'doc_123',
      state: 'processing',
      textractJobId: 'textract_job_123',
      alreadyCompleted: false,
      requestId: 'req_complete',
      traceId: '0123456789abcdef0123456789abcdef',
    })
    expect(deps.markUploadCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        workspaceId: 'workspace_123',
        actorUserId: 'user_123',
        eventType: 'document.upload_completed',
        verification: expect.objectContaining({
          s3Bucket: 'prizm-uploads-test',
          s3Key: 'user_123/doc_123/statement.pdf',
          sizeBytes: 4096,
          contentType: 'application/pdf',
          serverSideEncryption: 'aws:kms',
        }),
      }),
    )
    expect(deps.startTextractAnalysis).toHaveBeenCalledWith({
      documentId: 'doc_123',
      s3Bucket: 'prizm-uploads-test',
      s3Key: 'user_123/doc_123/statement.pdf',
    })
    expect(deps.markProcessingStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        textractJobId: 'textract_job_123',
        eventType: 'document.processing_started',
      }),
    )
  })

  it('fails closed with OCR start evidence when Textract cannot create a job', async () => {
    const deps = createDependencies()
    deps.startTextractAnalysis.mockRejectedValueOnce(new Error('textract unavailable'))

    const result = await completeDocumentUpload(completionInput(), deps)

    expect(result).toMatchObject({
      ok: false,
      reason: 'textract_start_failed',
      status: 502,
      code: 'PRZM_TEXTRACT_START_FAILED',
    })
    expect(deps.markProcessingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        eventType: 'document.processing_failed',
        failureReason: 'Textract analysis could not be started for the verified upload.',
      }),
    )
  })

  it('returns an idempotent result when completion is repeated for a processing document with a job id', async () => {
    const deps = createDependencies({
      document: documentRow({
        status: 'processing',
        textractJobId: 'textract_existing',
      }),
    })

    const result = await completeDocumentUpload(completionInput(), deps)

    expect(result).toEqual({
      ok: true,
      documentId: 'doc_123',
      state: 'processing',
      textractJobId: 'textract_existing',
      alreadyCompleted: true,
      requestId: 'req_complete',
      traceId: '0123456789abcdef0123456789abcdef',
    })
    expect(deps.headObject).not.toHaveBeenCalled()
    expect(deps.markUploadCompleted).not.toHaveBeenCalled()
    expect(deps.startTextractAnalysis).not.toHaveBeenCalled()
  })
})

function completionInput() {
  return {
    documentId: 'doc_123',
    actorUserId: 'user_123',
    actorIp: '203.0.113.10',
    actorUserAgent: 'vitest',
    routeContext: {
      requestId: 'req_complete',
      traceId: '0123456789abcdef0123456789abcdef',
      pathname: '/api/v1/documents/doc_123/complete',
    },
  }
}

function createDependencies(overrides: { document?: CompletionDocument | null } = {}) {
  const deps = {
    getUploadBucket: vi.fn(() => 'prizm-uploads-test'),
    getKmsKeyId: vi.fn(() => 'kms-test-key'),
    getUserProfile: vi.fn().mockResolvedValue({
      workspaceId: 'workspace_123',
      role: 'member',
    }),
    getDocument: vi.fn().mockResolvedValue(overrides.document ?? documentRow()),
    headObject: vi.fn().mockResolvedValue({
      contentLength: 4096,
      contentType: 'application/pdf',
      serverSideEncryption: 'aws:kms',
      sseKmsKeyId: 'kms-test-key',
    }),
    markUploadCompleted: vi.fn().mockResolvedValue(undefined),
    startTextractAnalysis: vi.fn().mockResolvedValue('textract_job_123'),
    markProcessingStarted: vi.fn().mockResolvedValue(undefined),
    markProcessingFailed: vi.fn().mockResolvedValue(undefined),
  } satisfies DocumentCompletionDependencies
  return deps
}

function documentRow(overrides: Partial<CompletionDocument> = {}): CompletionDocument {
  return {
    id: 'doc_123',
    workspaceId: 'workspace_123',
    uploadedBy: 'user_123',
    status: 'pending',
    filename: 'statement.pdf',
    contentType: 'application/pdf',
    sizeBytes: 4096,
    s3Bucket: 'prizm-uploads-test',
    s3Key: 'user_123/doc_123/statement.pdf',
    textractJobId: null,
    failureReason: null,
    ...overrides,
  }
}

function notFoundError(): Error {
  return Object.assign(new Error('not found'), {
    name: 'NotFound',
    $metadata: { httpStatusCode: 404 },
  })
}
