import { describe, expect, it, vi } from 'vitest'
import fixture from '../fixtures/parser/textract-single-statement.json'
import {
  processTextractDocuments,
  type DocumentProcessingDependencies,
} from '@/lib/server/document-processing'

describe('processTextractDocuments', () => {
  it('stores parsed statements, marks documents ready, consumes reservations, and audits completed jobs', async () => {
    const now = new Date('2026-05-06T22:15:00.000Z')
    const deps = createDependencies()

    const result = await processTextractDocuments({ now, limit: 25, trigger: 'test' }, deps)

    expect(result).toEqual({
      status: 'ok',
      polled: 1,
      ready: 1,
      failed: 0,
      skipped: 0,
    })
    expect(deps.listProcessingDocuments).toHaveBeenCalledWith({ limit: 25 })
    expect(deps.getTextractAnalysis).toHaveBeenCalledWith({ jobId: 'textract_job_123' })
    expect(deps.storeParsedStatement).toHaveBeenCalledWith({
      documentId: 'doc_123',
      workspaceId: 'workspace_123',
      expiresAt: '2026-05-07T22:15:00.000Z',
      statement: expect.objectContaining({
        bankName: 'PRIZM Credit Union',
        accountLast4: '4242',
        reconciles: true,
        ready: true,
        reviewFlags: ['low_confidence_transactions'],
        transactions: expect.arrayContaining([
          expect.objectContaining({
            date: '2026-04-18',
            description: 'Payroll Deposit',
            amount: 262.75,
          }),
        ]),
      }),
    })
    expect(deps.markDocumentReady).toHaveBeenCalledWith({
      documentId: 'doc_123',
      convertedAt: now.toISOString(),
    })
    expect(deps.consumeCreditReservation).toHaveBeenCalledWith({
      documentId: 'doc_123',
      consumedAt: now.toISOString(),
    })
    expect(vi.mocked(deps.consumeCreditReservation).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deps.markDocumentReady).mock.invocationCallOrder[0],
    )
    expect(deps.releaseCreditReservation).not.toHaveBeenCalled()
    expect(deps.recordAuditEvent).toHaveBeenCalledWith({
      eventType: 'document.processing_ready',
      workspaceId: 'workspace_123',
      actorUserId: null,
      targetType: 'document',
      targetId: 'doc_123',
      metadata: {
        trigger: 'test',
        textract_job_id: 'textract_job_123',
        statement_count: 1,
        request_id: null,
        trace_id: null,
      },
    })
  })

  it('marks failed Textract output failed, releases the reservation, and audits the failure', async () => {
    const now = new Date('2026-05-06T22:45:00.000Z')
    const deps = createDependencies()
    vi.mocked(deps.getTextractAnalysis).mockResolvedValueOnce({ JobStatus: 'FAILED', Blocks: [] })

    const result = await processTextractDocuments({ now, limit: 25, trigger: 'test' }, deps)

    expect(result).toEqual({
      status: 'failed',
      polled: 1,
      ready: 0,
      failed: 1,
      skipped: 0,
    })
    expect(deps.storeParsedStatement).not.toHaveBeenCalled()
    expect(deps.markDocumentReady).not.toHaveBeenCalled()
    expect(deps.consumeCreditReservation).not.toHaveBeenCalled()
    expect(deps.markDocumentFailed).toHaveBeenCalledWith({
      documentId: 'doc_123',
      failureReason: 'Textract analysis finished with status FAILED.',
    })
    expect(deps.releaseCreditReservation).toHaveBeenCalledWith({
      documentId: 'doc_123',
      releasedAt: now.toISOString(),
    })
    expect(vi.mocked(deps.releaseCreditReservation).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deps.markDocumentFailed).mock.invocationCallOrder[0],
    )
    expect(deps.recordAuditEvent).toHaveBeenCalledWith({
      eventType: 'document.processing_failed',
      workspaceId: 'workspace_123',
      actorUserId: null,
      targetType: 'document',
      targetId: 'doc_123',
      metadata: {
        trigger: 'test',
        textract_job_id: 'textract_job_123',
        failure_reason: 'Textract analysis finished with status FAILED.',
        request_id: null,
        trace_id: null,
      },
    })
  })
})

function createDependencies(): DocumentProcessingDependencies {
  return {
    listProcessingDocuments: vi.fn().mockResolvedValue([
      {
        id: 'doc_123',
        workspaceId: 'workspace_123',
        textractJobId: 'textract_job_123',
      },
    ]),
    getTextractAnalysis: vi.fn().mockResolvedValue(fixture),
    storeParsedStatement: vi.fn().mockResolvedValue(undefined),
    markDocumentReady: vi.fn().mockResolvedValue(undefined),
    markDocumentFailed: vi.fn().mockResolvedValue(undefined),
    consumeCreditReservation: vi.fn().mockResolvedValue(undefined),
    releaseCreditReservation: vi.fn().mockResolvedValue(undefined),
    recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  }
}
