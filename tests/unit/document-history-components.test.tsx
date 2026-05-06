import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  DocumentHistoryList,
  DocumentReview,
  DocumentStateBadge,
  type HistoryDocumentView,
} from '@/components/app/document-history'

describe('DocumentHistoryList', () => {
  it('renders an empty state before any document records exist', () => {
    render(<DocumentHistoryList documents={[]} />)

    expect(screen.getByRole('heading', { name: 'No statements yet' })).toBeInTheDocument()
    expect(
      screen.getByText(/Upload a PDF statement to create the first document record/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Upload statement' })).toHaveAttribute('href', '/app')
  })

  it('renders real document rows with statement, audit, and deletion evidence', () => {
    render(<DocumentHistoryList documents={[historyDocument()]} />)

    expect(screen.getByRole('link', { name: 'May Statement.pdf' })).toHaveAttribute(
      'href',
      '/app/history/doc_ready',
    )
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0)
    expect(screen.getByText('Ready for review')).toBeInTheDocument()
    expect(screen.getByText('Acme Bank')).toBeInTheDocument()
    expect(screen.getByText('document.ready')).toBeInTheDocument()
    expect(screen.getByText('Receipt sent')).toBeInTheDocument()
  })

  it('shows OCR processing evidence in history rows before statement extraction finishes', () => {
    render(<DocumentHistoryList documents={[processingDocument()]} />)

    expect(screen.getAllByText('Processing').length).toBeGreaterThan(0)
    expect(screen.getByText('OCR running')).toBeInTheDocument()
    expect(screen.getByText('OCR processing')).toBeInTheDocument()
    expect(screen.getByText('Textract job ID')).toBeInTheDocument()
    expect(screen.getByText('textract_job_123')).toBeInTheDocument()
    expect(screen.getByText('0123456789abcdef0123456789abcdef')).toBeInTheDocument()
    expect(screen.getByText('document.processing_started')).toBeInTheDocument()
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
    expect(screen.getByText(/remaining/)).toBeInTheDocument()
  })
})

describe('DocumentReview', () => {
  it('shows processing evidence with the Textract job id while OCR is running', () => {
    render(<DocumentReview document={processingDocument()} />)

    expect(screen.getByRole('heading', { name: 'Statement summary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Transaction table' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Export readiness' })).toBeInTheDocument()
    expect(screen.getAllByText('Textract job ID').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('textract_job_123').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Trace ID').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('0123456789abcdef0123456789abcdef').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('document.upload_completed')).toBeInTheDocument()
    expect(screen.getByText('document.processing_started')).toBeInTheDocument()
    expect(screen.getAllByText('Elapsed time')).toHaveLength(1)
    expect(screen.getAllByText('Retention deadline')).toHaveLength(1)
    expect(screen.getByText('Statement pending OCR')).toBeInTheDocument()
    expect(screen.getAllByText('Export waiting').length).toBeGreaterThan(0)
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

  it('shows distinct recovery for S3 verification failure', () => {
    render(<DocumentReview document={s3VerificationFailedDocument()} />)

    expect(screen.getByRole('heading', { name: 'Failure recovery' })).toBeInTheDocument()
    expect(screen.getAllByText('S3 verification failed').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/S3 object metadata did not match the pending upload record/).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('req_failed').length).toBeGreaterThan(0)
    expect(screen.getByText(/Upload the original PDF again/)).toBeInTheDocument()
  })

  it('shows distinct recovery for OCR start and OCR processing failures', () => {
    const { rerender } = render(<DocumentReview document={failedDocument()} />)

    expect(screen.getAllByText('OCR start failed').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Textract analysis could not be started/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('trace_failed').length).toBeGreaterThan(0)

    rerender(<DocumentReview document={ocrProcessingFailedDocument()} />)

    expect(screen.getAllByText('OCR processing failed').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Textract job failed during OCR processing/).length).toBeGreaterThan(
      0,
    )
    expect(screen.getAllByText('textract_failed_123').length).toBeGreaterThan(0)
  })

  it('shows extraction incomplete and reconciliation mismatch recovery before export', () => {
    render(<DocumentReview document={incompleteMismatchDocument()} />)

    expect(screen.getAllByText('Extraction incomplete').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Reconciliation mismatch').length).toBeGreaterThan(0)
    expect(screen.getByText(/missing account last 4, statement period/)).toBeInTheDocument()
    expect(screen.getByText('Transaction row 1')).toBeInTheDocument()
    expect(screen.getAllByText('Export blocked').length).toBeGreaterThan(0)
  })
})

describe('DocumentStateBadge', () => {
  it('labels every document state in the persisted state model', () => {
    render(
      <div>
        <DocumentStateBadge state="pending" />
        <DocumentStateBadge state="processing" />
        <DocumentStateBadge state="ready" />
        <DocumentStateBadge state="failed" />
        <DocumentStateBadge state="expired" />
      </div>,
    )

    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Processing')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })
})

function historyDocument(): HistoryDocumentView {
  return {
    id: 'doc_ready',
    filename: 'May Statement.pdf',
    state: 'ready',
    createdAt: '2026-05-06T14:00:00.000Z',
    expiresAt: '2026-05-07T14:00:00.000Z',
    deletedAt: null,
    failureReason: null,
    sizeBytes: 4096,
    contentType: 'application/pdf',
    pages: 4,
    s3Bucket: 'prizm-uploads',
    s3Key: 'workspace/doc/May_Statement.pdf',
    textractJobId: 'textract-123',
    statements: [
      {
        id: 'statement_123',
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
        expiresAt: '2026-05-07T14:00:00.000Z',
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

function processingDocument(): HistoryDocumentView {
  return {
    ...historyDocument(),
    id: 'doc_processing',
    filename: 'Processing Statement.pdf',
    state: 'processing',
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
    textractJobId: 'textract_failed_123',
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
