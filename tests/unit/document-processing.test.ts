import { describe, expect, it, vi } from 'vitest'
import {
  processExtractionDocuments,
  storeParsedStatement,
  type DocumentProcessingDependencies,
} from '@/lib/server/document-processing'
import { getServiceRoleClient } from '@/lib/server/supabase'
import type { ParsedStatement } from '@/lib/server/statement-parser'

vi.mock('@/lib/server/supabase', () => ({
  getServiceRoleClient: vi.fn(),
}))

describe('processExtractionDocuments', () => {
  it('stores extracted statements, marks documents ready, consumes reservations, and audits completed jobs', async () => {
    const now = new Date('2026-05-06T22:15:00.000Z')
    const deps = createDependencies()

    const result = await processExtractionDocuments({ now, limit: 25, trigger: 'test' }, deps)

    expect(result).toEqual({
      status: 'ok',
      polled: 1,
      ready: 1,
      failed: 0,
      skipped: 0,
    })
    expect(deps.listProcessingDocuments).toHaveBeenCalledWith({ limit: 25 })
    expect(deps.pollExtraction).toHaveBeenCalledWith({
      engine: 'textract',
      jobId: 'textract_job_123',
    })
    expect(deps.storeParsedStatement).toHaveBeenCalledWith({
      documentId: 'doc_123',
      workspaceId: 'workspace_123',
      expiresAt: '2026-05-07T22:15:00.000Z',
      statement: expect.objectContaining({
        statementType: 'bank',
        metadata: {},
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
        extraction_engine: 'textract',
        extraction_job_id: 'textract_job_123',
        textract_job_id: 'textract_job_123',
        statement_count: 1,
        request_id: null,
        trace_id: null,
      },
    })
  })

  it('stores structured unreconciled extraction for review instead of failing the document', async () => {
    const now = new Date('2026-05-06T22:25:00.000Z')
    const deps = createDependencies()
    vi.mocked(deps.pollExtraction).mockResolvedValueOnce({
      status: 'succeeded',
      engine: 'textract',
      jobId: 'textract_job_123',
      statements: [
        parsedStatement({
          reportedTotal: 500,
          computedTotal: 250.5,
          reconciles: false,
          ready: false,
          reviewFlags: ['reconciliation_mismatch'],
        }),
      ],
    })

    const result = await processExtractionDocuments({ now, limit: 25, trigger: 'test' }, deps)

    expect(result).toEqual({
      status: 'ok',
      polled: 1,
      ready: 1,
      failed: 0,
      skipped: 0,
    })
    expect(deps.storeParsedStatement).toHaveBeenCalledWith({
      documentId: 'doc_123',
      workspaceId: 'workspace_123',
      expiresAt: '2026-05-07T22:25:00.000Z',
      statement: expect.objectContaining({
        reconciles: false,
        ready: false,
        reviewFlags: ['reconciliation_mismatch'],
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
    expect(deps.markDocumentFailed).not.toHaveBeenCalled()
    expect(deps.releaseCreditReservation).not.toHaveBeenCalled()
  })

  it('persists credit-card statement type and metadata with parsed statement evidence', async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null })
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert }),
    } as unknown as ReturnType<typeof getServiceRoleClient>)
    const statement = {
      statementType: 'credit_card',
      metadata: {
        issuer: 'PRIZM Card Services',
        paymentDueDate: '2026-05-25',
      },
      bankName: 'PRIZM Card Services',
      accountLast4: '4242',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      openingBalance: 125.5,
      closingBalance: 490.25,
      reportedTotal: 364.75,
      computedTotal: 364.75,
      reconciles: true,
      ready: true,
      confidence: { overall: 0.98, fields: 0.98, transactions: 0.98 },
      reviewFlags: [],
      transactions: [
        {
          date: '2026-04-15',
          description: 'Card purchase',
          amount: 42.5,
          confidence: 0.99,
        },
      ],
    } as ParsedStatement & {
      statementType: 'credit_card'
      metadata: { issuer: string; paymentDueDate: string }
    }

    await storeParsedStatement({
      documentId: 'doc_card_123',
      workspaceId: 'workspace_123',
      expiresAt: '2026-05-07T22:15:00.000Z',
      statement,
    })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: 'doc_card_123',
        workspace_id: 'workspace_123',
        statement_type: 'credit_card',
        statement_metadata: {
          issuer: 'PRIZM Card Services',
          paymentDueDate: '2026-05-25',
        },
      }),
    )
  })

  it('marks failed Textract output failed, releases the reservation, and audits the failure', async () => {
    const now = new Date('2026-05-06T22:45:00.000Z')
    const deps = createDependencies()
    vi.mocked(deps.pollExtraction).mockResolvedValueOnce({
      status: 'failed',
      engine: 'textract',
      jobId: 'textract_job_123',
      failureReason: 'Textract analysis finished with status FAILED.',
    })

    const result = await processExtractionDocuments({ now, limit: 25, trigger: 'test' }, deps)

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
        extraction_engine: 'textract',
        extraction_job_id: 'textract_job_123',
        textract_job_id: 'textract_job_123',
        failure_reason: 'Textract analysis finished with status FAILED.',
        request_id: null,
        trace_id: null,
      },
    })
  })

  it('targets one processing document when status polling drives finalization', async () => {
    const now = new Date('2026-05-06T22:55:00.000Z')
    const deps = createDependencies()
    const routeContext = {
      requestId: 'req_status',
      traceId: '0123456789abcdef0123456789abcdef',
      pathname: '/api/v1/documents/doc_123/status',
    }

    const result = await processExtractionDocuments(
      {
        now,
        limit: 1,
        documentId: 'doc_123',
        trigger: 'status',
        routeContext,
      },
      deps,
    )

    expect(result).toEqual({
      status: 'ok',
      polled: 1,
      ready: 1,
      failed: 0,
      skipped: 0,
    })
    expect(deps.listProcessingDocuments).toHaveBeenCalledWith({
      limit: 1,
      documentId: 'doc_123',
    })
    expect(deps.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          trigger: 'status',
          request_id: 'req_status',
          trace_id: '0123456789abcdef0123456789abcdef',
        }),
      }),
    )
  })
})

function createDependencies(): DocumentProcessingDependencies {
  return {
    listProcessingDocuments: vi.fn().mockResolvedValue([
      {
        id: 'doc_123',
        workspaceId: 'workspace_123',
        extractionEngine: 'textract',
        extractionJobId: 'textract_job_123',
        textractJobId: 'textract_job_123',
      },
    ]),
    pollExtraction: vi.fn().mockResolvedValue({
      status: 'succeeded',
      engine: 'textract',
      jobId: 'textract_job_123',
      statements: [parsedStatement()],
    }),
    storeParsedStatement: vi.fn().mockResolvedValue(undefined),
    markDocumentReady: vi.fn().mockResolvedValue(undefined),
    markDocumentFailed: vi.fn().mockResolvedValue(undefined),
    consumeCreditReservation: vi.fn().mockResolvedValue(undefined),
    releaseCreditReservation: vi.fn().mockResolvedValue(undefined),
    recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  }
}

function parsedStatement(overrides: Partial<ParsedStatement> = {}): ParsedStatement {
  return {
    statementType: 'bank',
    metadata: {},
    bankName: 'PRIZM Credit Union',
    accountLast4: '4242',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
    openingBalance: 1000,
    closingBalance: 1250.5,
    reportedTotal: 250.5,
    computedTotal: 250.5,
    reconciles: true,
    ready: true,
    confidence: { overall: 0.96, fields: 0.98, transactions: 0.89 },
    reviewFlags: ['low_confidence_transactions'],
    transactions: [
      {
        date: '2026-04-03',
        description: 'Coffee Shop',
        amount: -12.25,
        confidence: 0.97,
      },
      {
        date: '2026-04-18',
        description: 'Payroll Deposit',
        amount: 262.75,
        confidence: 0.82,
      },
    ],
    ...overrides,
  }
}
