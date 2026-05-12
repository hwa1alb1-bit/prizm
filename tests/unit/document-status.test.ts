import { describe, expect, it, vi } from 'vitest'
import { getDocumentStatus, type DocumentStatusDependencies } from '@/lib/server/document-status'

describe('getDocumentStatus', () => {
  it('finalizes a processing document from the status path and returns the refreshed state', async () => {
    const routeContext = {
      requestId: 'req_status',
      traceId: '0123456789abcdef0123456789abcdef',
      pathname: '/api/v1/documents/doc_123/status',
    }
    const processingDocument = documentStatusRow({ status: 'processing' })
    const readyDocument = documentStatusRow({ status: 'ready' })
    const deps: DocumentStatusDependencies = {
      getUserProfile: vi.fn().mockResolvedValue({
        workspaceId: 'workspace_123',
        role: 'member',
      }),
      getDocument: vi
        .fn()
        .mockResolvedValueOnce(processingDocument)
        .mockResolvedValueOnce(readyDocument),
      finalizeProcessingDocument: vi.fn().mockResolvedValue(undefined),
      now: vi.fn(() => new Date('2026-05-06T22:15:00.000Z')),
    }

    const result = await getDocumentStatus(
      {
        documentId: 'doc_123',
        actorUserId: 'user_123',
        routeContext,
      },
      deps,
    )

    expect(deps.finalizeProcessingDocument).toHaveBeenCalledWith({
      documentId: 'doc_123',
      routeContext,
    })
    expect(deps.getDocument).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({
      ok: true,
      documentId: 'doc_123',
      state: 'ready',
      extractionEngine: 'textract',
      extractionJobId: 'textract_job_123',
      textractJobId: 'textract_job_123',
      requestId: 'req_status',
      traceId: '0123456789abcdef0123456789abcdef',
    })
  })

  it('does not expose worker job ids through the Textract compatibility field', async () => {
    const routeContext = {
      requestId: 'req_status',
      traceId: '0123456789abcdef0123456789abcdef',
      pathname: '/api/v1/documents/doc_123/status',
    }
    const deps: DocumentStatusDependencies = {
      getUserProfile: vi.fn().mockResolvedValue({
        workspaceId: 'workspace_123',
        role: 'member',
      }),
      getDocument: vi.fn().mockResolvedValue(
        documentStatusRow({
          status: 'processing',
          extractionEngine: 'kotlin_worker',
          extractionJobId: 'worker_job_123',
          textractJobId: null,
        }),
      ),
      finalizeProcessingDocument: vi.fn().mockResolvedValue(undefined),
      now: vi.fn(() => new Date('2026-05-06T22:15:00.000Z')),
    }

    const result = await getDocumentStatus(
      {
        documentId: 'doc_123',
        actorUserId: 'user_123',
        routeContext,
      },
      deps,
    )

    expect(result).toMatchObject({
      ok: true,
      extractionEngine: 'kotlin_worker',
      extractionJobId: 'worker_job_123',
      textractJobId: null,
    })
  })
})

function documentStatusRow({
  status,
  extractionEngine = 'textract',
  extractionJobId = 'textract_job_123',
  textractJobId = 'textract_job_123',
}: {
  status: string
  extractionEngine?: string
  extractionJobId?: string
  textractJobId?: string | null
}) {
  return {
    id: 'doc_123',
    workspaceId: 'workspace_123',
    status,
    extractionEngine,
    extractionJobId,
    textractJobId,
    chargeStatus: 'reserved',
    duplicateOfDocumentId: null,
    expiresAt: '2026-05-07T22:15:00.000Z',
    deletedAt: null,
  }
}
