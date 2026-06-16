import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DocumentHistoryList,
  DocumentReview,
  DocumentStateBadge,
  type HistoryDocumentView,
} from '@/components/app/document-history'

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
  fetchMock.mockResolvedValue(statusResponse('processing'))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('DocumentHistoryList', () => {
  it('renders an empty state before any document records exist', () => {
    render(<DocumentHistoryList documents={[]} />)

    expect(screen.getByRole('heading', { name: 'No statements yet' })).toBeInTheDocument()
    expect(screen.getByText(/Upload a PDF statement to start/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Upload statement' })).toHaveAttribute('href', '/app')
  })

  it('renders real document rows with a compact evidence timeline', () => {
    render(<DocumentHistoryList documents={[historyDocument()]} />)

    expect(screen.getByRole('link', { name: 'May Statement.pdf' })).toHaveAttribute(
      'href',
      '/app/history/doc_ready',
    )
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0)
    expect(screen.getByText('Ready for review')).toBeInTheDocument()
    expect(screen.getByText('Evidence timeline')).toBeInTheDocument()
    expect(screen.getByText('Upload requested')).toBeInTheDocument()
    expect(screen.getByText('Document verified')).toBeInTheDocument()
    expect(screen.getByText('Statement extracted')).toBeInTheDocument()
    expect(screen.getByText('Export ready')).toBeInTheDocument()
    expect(screen.getByText('Deletion completed')).toBeInTheDocument()
    expect(screen.getAllByText('Proven').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Waiting').length).toBeGreaterThan(0)
  })

  it('shows long-running extraction evidence in history rows before statement extraction finishes', () => {
    render(<DocumentHistoryList documents={[processingDocument()]} />)

    expect(screen.getAllByText('Processing').length).toBeGreaterThan(0)
    expect(screen.getByText('Extraction running')).toBeInTheDocument()
    expect(screen.getByText('Extraction completed')).toBeInTheDocument()
    expect(
      screen.getByText(
        /StatementStudio has proven upload, document verification, and conversion start/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/waiting for the conversion to complete/)).toBeInTheDocument()
    expect(screen.getAllByText('Now').length).toBeGreaterThan(0)
  })

  it('shows verified uploads as storage-complete work instead of failures', () => {
    render(<DocumentHistoryList documents={[verifiedDocument()]} />)

    expect(screen.getAllByText('Verified').length).toBeGreaterThan(0)
    expect(screen.getByText('Storage verified')).toBeInTheDocument()
    expect(screen.queryByText('Action needed')).not.toBeInTheDocument()
    expect(screen.getByText('Document verified')).toBeInTheDocument()
  })

  it('filters the queue by status and keeps counts visible', () => {
    render(
      <DocumentHistoryList
        documents={[historyDocument(), processingDocument(), failedDocument()]}
        activeFilter="failed"
      />,
    )

    expect(screen.getByRole('link', { name: 'All, 3 documents' })).toHaveAttribute(
      'href',
      '/app/history',
    )
    expect(screen.getByRole('link', { name: 'Processing, 1 document' })).toHaveAttribute(
      'href',
      '/app/history?status=processing',
    )
    expect(screen.getByRole('link', { name: 'Failed, 1 document' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'June Statement.pdf' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'May Statement.pdf' })).not.toBeInTheDocument()
    expect(screen.getByText('Action needed')).toBeInTheDocument()
  })

  it('filters documents approaching the retention deadline', () => {
    render(
      <DocumentHistoryList
        documents={[notExpiringDocument(), expiringSoonDocument()]}
        activeFilter="expiring-soon"
      />,
    )

    expect(screen.getByRole('link', { name: 'Expiring Statement.pdf' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Not Expiring.pdf' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Expiring soon').length).toBeGreaterThan(0)
    expect(screen.getByText(/Retention is open until/)).toBeInTheDocument()
  })
})

describe('DocumentReview', () => {
  it('shows processing evidence with the Textract job id while extraction is running', () => {
    render(<DocumentReview document={processingDocument()} />)

    expect(screen.getByRole('heading', { name: 'Evidence timeline' })).toBeInTheDocument()
    expect(screen.getByText('Upload requested')).toBeInTheDocument()
    expect(screen.getByText('Document verified')).toBeInTheDocument()
    expect(screen.getByText('Extraction completed')).toBeInTheDocument()
    expect(screen.getByText('Statement extracted')).toBeInTheDocument()
    expect(screen.getByText('Export ready')).toBeInTheDocument()
    expect(screen.getByText('Deletion completed')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Statement summary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Transaction table' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Export readiness' })).toBeInTheDocument()
    expect(
      screen.getByText(/StatementStudio has proven the upload request, document verification/),
    ).toBeInTheDocument()
    expect(screen.getByText('Transaction rows pending extraction')).toBeInTheDocument()
    expect(screen.queryByText('Textract job ID')).not.toBeInTheDocument()
    expect(screen.queryByText('textract_job_123')).not.toBeInTheDocument()
    expect(screen.queryByText('Trace ID')).not.toBeInTheDocument()
    expect(screen.queryByText('0123456789abcdef0123456789abcdef')).not.toBeInTheDocument()
    expect(screen.getByText('Upload complete')).toBeInTheDocument()
    expect(screen.getByText('Processing started')).toBeInTheDocument()
    expect(screen.getAllByText('Elapsed time')).toHaveLength(1)
    expect(screen.getAllByText('Retention deadline').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Statement extraction pending')).toBeInTheDocument()
    expect(screen.getAllByText('Export waiting').length).toBeGreaterThan(0)
  })

  it('shows conversion evidence without vendor extraction job copy', () => {
    render(<DocumentReview document={cloudflareProcessingDocument()} />)

    expect(screen.queryByText('Cloudflare job ID')).not.toBeInTheDocument()
    expect(screen.queryByText('cf_job_123')).not.toBeInTheDocument()
    expect(screen.queryByText(/Cloudflare extraction job/)).not.toBeInTheDocument()
    expect(screen.queryByText('Textract job ID')).not.toBeInTheDocument()
    expect(screen.getByText(/Conversion is in progress for this document/)).toBeInTheDocument()
  })

  it('polls document status and refreshes once when processing reaches a terminal state', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(statusResponse('ready'))

    render(<DocumentReview document={processingDocument()} />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/documents/doc_processing/status', {
      cache: 'no-store',
    })
    expect(refresh).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('renders the extracted statement review surface for dense accounting work', () => {
    render(<DocumentReview document={historyDocument()} />)

    expect(screen.getByRole('heading', { name: 'Statement summary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Transaction table' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Exceptions' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Reconciliation result' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Export readiness' })).toBeInTheDocument()
    expect(screen.getByText('ACH Payroll')).toBeInTheDocument()
    expect(screen.getByText('Bank service fee')).toBeInTheDocument()
    expect(screen.getByText('No exceptions flagged')).toBeInTheDocument()
    expect(screen.getAllByText('Ready to export').length).toBeGreaterThan(0)
  })

  it('does not display per-row confidence percentages to end users', () => {
    render(<DocumentReview document={historyDocument()} />)

    expect(screen.queryAllByText(/Confidence/i)).toHaveLength(0)
    expect(screen.queryAllByText(/^\d{1,3}%$/)).toHaveLength(0)
  })

  it('keeps primary sections visible and collapses system-detail behind disclosure', () => {
    render(<DocumentReview document={historyDocument()} />)

    expect(screen.getByRole('heading', { name: 'Statement summary' }).closest('details')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Transaction table' }).closest('details')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Export readiness' }).closest('details')).toBeNull()

    expect(
      screen.getByRole('heading', { name: 'Audit trail' }).closest('details'),
    ).not.toHaveAttribute('open')
    expect(
      screen.getByRole('heading', { name: 'Document record' }).closest('details'),
    ).not.toHaveAttribute('open')
    expect(
      screen.getByRole('heading', { name: 'Exceptions' }).closest('details'),
    ).not.toHaveAttribute('open')
  })

  it('auto-opens exceptions and reconciliation when they need attention', () => {
    render(<DocumentReview document={incompleteMismatchDocument()} />)

    expect(screen.getByRole('heading', { name: 'Exceptions' }).closest('details')).toHaveAttribute(
      'open',
    )
    expect(
      screen.getByRole('heading', { name: 'Reconciliation result' }).closest('details'),
    ).toHaveAttribute('open')
  })

  it('renders credit-card statement metadata and visible export actions', () => {
    render(<DocumentReview document={creditCardDocument()} />)

    expect(screen.getAllByText('Issuer').length).toBeGreaterThan(0)
    expect(screen.getByText('PRIZM Rewards Visa')).toBeInTheDocument()
    expect(screen.getByText('Card')).toBeInTheDocument()
    expect(screen.getByText('Payment due date')).toBeInTheDocument()
    expect(screen.getByText('May 25, 2026')).toBeInTheDocument()
    expect(screen.getByText('Minimum payment')).toBeInTheDocument()
    expect(screen.getByText('New balance')).toBeInTheDocument()
    expect(screen.getByText('Rewards earned')).toBeInTheDocument()
    expect(screen.getByText('Fees charged')).toBeInTheDocument()
    expect(screen.getByText('Interest charged')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'XLSX' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'QuickBooks CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xero CSV' })).toBeInTheDocument()
  })

  it('blocks visible export actions until statement review is complete', () => {
    render(<DocumentReview document={unreviewedDocument()} />)

    expect(screen.getAllByText('Export blocked').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Statement review must be completed before export.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'CSV' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'XLSX' })).not.toBeInTheDocument()
  })

  it('blocks visible export actions when review status is missing', () => {
    render(<DocumentReview document={missingReviewStatusDocument()} />)

    expect(screen.getAllByText('Export blocked').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Statement review must be completed before export.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'CSV' })).not.toBeInTheDocument()
  })

  it('shows distinct recovery for S3 verification failure', () => {
    render(<DocumentReview document={s3VerificationFailedDocument()} />)

    expect(screen.getByRole('heading', { name: 'Failure recovery' })).toBeInTheDocument()
    expect(screen.getAllByText('Document verification failed').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/The uploaded document did not match the pending record/).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('doc_s3_failed').length).toBeGreaterThan(0)
    expect(screen.queryByText('req_failed')).not.toBeInTheDocument()
    expect(screen.getByText(/Upload the original PDF again/)).toBeInTheDocument()
  })

  it('shows distinct recovery for extraction start and extraction processing failures', () => {
    const { rerender } = render(<DocumentReview document={failedDocument()} />)

    expect(screen.getAllByText('Extraction start failed').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Conversion could not be started/).length).toBeGreaterThan(0)
    expect(screen.queryByText('trace_failed')).not.toBeInTheDocument()

    rerender(<DocumentReview document={ocrProcessingFailedDocument()} />)

    expect(screen.getAllByText('Extraction processing failed').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Conversion failed while reading the document/).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText('textract_failed_123')).not.toBeInTheDocument()
  })

  it('shows extraction incomplete and reconciliation mismatch recovery before export', () => {
    render(<DocumentReview document={incompleteMismatchDocument()} />)

    expect(screen.getAllByText('Extraction incomplete').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Reconciliation mismatch').length).toBeGreaterThan(0)
    expect(screen.getByText(/missing account last 4, statement period/)).toBeInTheDocument()
    expect(screen.getAllByText('Transaction row 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Export blocked').length).toBeGreaterThan(0)
  })

  it('uses scheduled auto-delete copy until deletion evidence exists', () => {
    const { rerender } = render(<DocumentReview document={notExpiringDocument()} />)

    expect(screen.getByText(/Scheduled to auto-delete until/)).toBeInTheDocument()
    expect(screen.queryByText('Deleted')).not.toBeInTheDocument()

    rerender(<DocumentReview document={historyDocument()} />)

    expect(screen.getByText('Deleted')).toBeInTheDocument()
  })
})

describe('DocumentStateBadge', () => {
  it('labels every document state in the persisted state model', () => {
    render(
      <div>
        <DocumentStateBadge state="pending" />
        <DocumentStateBadge state="verified" />
        <DocumentStateBadge state="processing" />
        <DocumentStateBadge state="ready" />
        <DocumentStateBadge state="failed" />
        <DocumentStateBadge state="expired" />
      </div>,
    )

    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('Processing')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })
})

function statusResponse(state: string): Response {
  return new Response(JSON.stringify({ state }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function historyDocument(): HistoryDocumentView {
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
        transactionCount: 2,
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
          {
            id: 'txn_fee',
            postedAt: '2026-04-05',
            description: 'Bank service fee',
            amount: -10,
            debit: 10,
            credit: null,
            balance: 3490,
            confidence: 0.97,
            source: 'page_1_row_5',
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
    ],
    deletionEvidence: {
      receiptStatus: 'sent',
      receiptSentAt: '2026-05-07T14:01:00.000Z',
      receiptErrorCode: null,
      deletionAuditedAt: '2026-05-07T14:01:10.000Z',
    },
  }
}

function verifiedDocument(): HistoryDocumentView {
  return {
    ...historyDocument(),
    id: 'doc_verified',
    filename: 'Verified Statement.pdf',
    state: 'verified',
    extractionEngine: null,
    extractionJobId: null,
    textractJobId: null,
    statements: [],
    auditEvents: [
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

function processingDocument(): HistoryDocumentView {
  return {
    ...historyDocument(),
    id: 'doc_processing',
    filename: 'Processing Statement.pdf',
    state: 'processing',
    extractionEngine: 'textract',
    extractionJobId: 'textract_job_123',
    textractJobId: 'textract_job_123',
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

function failedDocument(): HistoryDocumentView {
  return {
    ...historyDocument(),
    id: 'doc_failed',
    filename: 'June Statement.pdf',
    state: 'failed',
    failureReason: 'Textract analysis could not be started for the verified upload.',
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

function s3VerificationFailedDocument(): HistoryDocumentView {
  return {
    ...failedDocument(),
    id: 'doc_s3_failed',
    filename: 'S3 Failed Statement.pdf',
    failureReason: 'S3 object metadata did not match the pending upload record: size_bytes.',
    textractJobId: null,
  }
}

function ocrProcessingFailedDocument(): HistoryDocumentView {
  return {
    ...failedDocument(),
    id: 'doc_ocr_processing_failed',
    filename: 'OCR Processing Failed.pdf',
    failureReason: 'Textract job failed during OCR processing.',
    extractionEngine: 'textract',
    extractionJobId: 'textract_failed_123',
    textractJobId: 'textract_failed_123',
  }
}

function cloudflareProcessingDocument(): HistoryDocumentView {
  return {
    ...processingDocument(),
    id: 'doc_cloudflare_processing',
    extractionEngine: 'cloudflare-r2',
    extractionJobId: 'cf_job_123',
    textractJobId: null,
  }
}

function incompleteMismatchDocument(): HistoryDocumentView {
  return {
    ...historyDocument(),
    id: 'doc_incomplete_mismatch',
    filename: 'Mismatch Statement.pdf',
    statements: [
      {
        ...historyDocument().statements[0]!,
        id: 'statement_mismatch',
        accountLast4: null,
        periodStart: null,
        periodEnd: null,
        reportedTotal: 250,
        computedTotal: 240,
        reconciles: false,
        transactions: [
          {
            id: 'txn_missing',
            postedAt: null,
            description: 'Description missing',
            amount: null,
            debit: null,
            credit: null,
            balance: null,
            confidence: 0.62,
            source: 'page_2_row_9',
            needsReview: true,
            reviewReason: 'Missing date, description, amount evidence.',
          },
        ],
        transactionCount: 1,
      },
    ],
  }
}

function expiringSoonDocument(): HistoryDocumentView {
  return {
    ...historyDocument(),
    id: 'doc_expiring',
    filename: 'Expiring Statement.pdf',
    expiresAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    deletionEvidence: null,
  }
}

function notExpiringDocument(): HistoryDocumentView {
  return {
    ...historyDocument(),
    id: 'doc_not_expiring',
    filename: 'Not Expiring.pdf',
    expiresAt: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
    deletionEvidence: null,
  }
}

function unreviewedDocument(): HistoryDocumentView {
  return {
    ...historyDocument(),
    id: 'doc_unreviewed',
    statements: [
      {
        ...historyDocument().statements[0]!,
        id: 'statement_unreviewed',
        reviewStatus: 'unreviewed',
      },
    ],
  }
}

function missingReviewStatusDocument(): HistoryDocumentView {
  return {
    ...historyDocument(),
    id: 'doc_missing_review_status',
    statements: [
      {
        ...historyDocument().statements[0]!,
        id: 'statement_missing_review_status',
        reviewStatus: null,
      },
    ],
  }
}

function creditCardDocument(): HistoryDocumentView {
  return {
    ...historyDocument(),
    id: 'doc_credit_card',
    filename: 'Rewards Visa.pdf',
    statements: [
      {
        ...historyDocument().statements[0]!,
        id: 'statement_credit_card',
        bankName: 'PRIZM Rewards Visa',
        accountLast4: '9876',
        openingBalance: 1200,
        closingBalance: 1066.2,
        reportedTotal: 1066.2,
        computedTotal: 1066.2,
        statementType: 'credit_card',
        statementMetadata: {
          paymentDueDate: '2026-05-25',
          minimumPaymentDue: 35,
          newBalance: 1066.2,
          rewardsEarned: 1,
          feeTotal: 29,
          interestTotal: 12.75,
        },
      },
    ],
  } as HistoryDocumentView
}
