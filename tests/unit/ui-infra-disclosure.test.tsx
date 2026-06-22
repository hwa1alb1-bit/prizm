import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentReview, type HistoryDocumentView } from '@/components/app/document-history'

const { fetchMock, refresh } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

beforeEach(() => {
  refresh.mockClear()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ state: 'processing' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// Regression guard: rendered UI must never disclose internal infrastructure.
const INFRA_DISCLOSURE =
  /S3 |Textract|Cloudflare job|Kotlin|Trace ID|SHA-256|\bBucket\b|document\.(ready|export_generated|upload_completed|processing_started)/

describe('UI infrastructure disclosure guard', () => {
  it('does not leak infra internals for a processing document', () => {
    const { container } = render(<DocumentReview document={processingDocument()} />)

    expect(container.textContent ?? '').not.toMatch(INFRA_DISCLOSURE)
  })

  it('does not leak infra internals for a ready document', () => {
    const { container } = render(<DocumentReview document={readyDocument()} />)

    expect(container.textContent ?? '').not.toMatch(INFRA_DISCLOSURE)
  })

  it('does not leak infra internals for a verification-failed document', () => {
    const { container } = render(<DocumentReview document={s3FailedDocument()} />)

    expect(container.textContent ?? '').not.toMatch(INFRA_DISCLOSURE)
  })
})

function readyDocument(): HistoryDocumentView {
  return {
    id: 'doc_ready',
    filename: 'May Statement.pdf',
    state: 'ready',
    createdAt: '2026-05-06T14:00:00.000Z',
    expiresAt: '2030-05-07T14:00:00.000Z',
    deletedAt: null,
    failureReason: null,
    sizeBytes: 4096,
    contentType: 'application/pdf',
    pages: 4,
    s3Bucket: 'prizm-uploads',
    s3Key: 'workspace/doc/May_Statement.pdf',
    extractionEngine: 'textract',
    extractionJobId: 'textract_job_123',
    textractJobId: 'textract_job_123',
    statements: [
      {
        id: 'statement_123',
        revision: 4,
        statementType: 'bank',
        statementMetadata: {},
        reviewStatus: 'reviewed',
        bankName: 'Acme Bank',
        accountLast4: '1234',
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
        openingBalance: 1000,
        closingBalance: 1250,
        reportedTotal: 2490,
        computedTotal: 2490,
        reconciles: true,
        transactionCount: 1,
        transactions: [
          {
            id: 'txn_payroll',
            postedAt: '2026-04-03',
            description: 'ACH Payroll',
            amount: 2500,
            debit: null,
            credit: 2500,
            balance: 3500,
            confidence: 0.99,
            source: 'page_1_row_4',
            needsReview: false,
            reviewReason: null,
          },
        ],
        createdAt: '2026-05-06T14:10:00.000Z',
        expiresAt: '2030-05-07T14:00:00.000Z',
        deletedAt: null,
      },
    ],
    auditEvents: [
      {
        id: 'audit_123',
        eventType: 'document.ready',
        createdAt: '2026-05-06T14:11:00.000Z',
        actorUserId: 'user_123',
        requestId: 'req_123',
        traceId: 'trace_123',
      },
      {
        id: 'audit_export',
        eventType: 'document.export_generated',
        createdAt: '2026-05-06T14:12:00.000Z',
        actorUserId: 'user_123',
        requestId: 'req_export',
        traceId: 'trace_export',
      },
    ],
    deletionEvidence: {
      receiptStatus: 'sent',
      receiptSentAt: '2026-05-07T14:01:00.000Z',
      receiptErrorCode: null,
      deletionAuditedAt: '2026-05-07T14:01:10.000Z',
    },
  }
}

function processingDocument(): HistoryDocumentView {
  return {
    ...readyDocument(),
    id: 'doc_processing',
    filename: 'Processing Statement.pdf',
    state: 'processing',
    extractionEngine: 'cloudflare-r2',
    extractionJobId: 'cf_job_123',
    textractJobId: null,
    statements: [],
    auditEvents: [
      {
        id: 'audit_processing',
        eventType: 'document.processing_started',
        createdAt: '2026-05-06T14:05:00.000Z',
        actorUserId: 'user_123',
        requestId: 'req_complete',
        traceId: '0123456789abcdef0123456789abcdef',
      },
      {
        id: 'audit_upload_completed',
        eventType: 'document.upload_completed',
        createdAt: '2026-05-06T14:04:00.000Z',
        actorUserId: 'user_123',
        requestId: 'req_complete',
        traceId: '0123456789abcdef0123456789abcdef',
      },
    ],
    deletionEvidence: null,
  }
}

function s3FailedDocument(): HistoryDocumentView {
  return {
    ...readyDocument(),
    id: 'doc_s3_failed',
    filename: 'Failed Statement.pdf',
    state: 'failed',
    failureReason: 'S3 object metadata did not match the pending upload record: size_bytes.',
    extractionEngine: null,
    extractionJobId: null,
    textractJobId: null,
    statements: [],
    auditEvents: [
      {
        id: 'audit_failed',
        eventType: 'document.processing_failed',
        createdAt: '2026-05-06T14:06:00.000Z',
        actorUserId: 'user_123',
        requestId: 'req_failed',
        traceId: 'trace_failed',
      },
    ],
    deletionEvidence: null,
  }
}
