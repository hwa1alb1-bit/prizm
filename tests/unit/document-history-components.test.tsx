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

    expect(screen.getByRole('heading', { name: 'Processing evidence' })).toBeInTheDocument()
    expect(screen.getAllByText('Textract job ID').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('textract_job_123').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Trace ID').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('0123456789abcdef0123456789abcdef').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Upload-completed audit event')).toBeInTheDocument()
    expect(screen.getByText(/document\.upload_completed at/)).toBeInTheDocument()
    expect(screen.getByText('Processing-started audit event')).toBeInTheDocument()
    expect(screen.getByText(/document\.processing_started at/)).toBeInTheDocument()
    expect(screen.getAllByText('Elapsed time')).toHaveLength(2)
    expect(screen.getAllByText('Retention deadline')).toHaveLength(2)
    expect(screen.getByText('Statement pending OCR')).toBeInTheDocument()
    expect(screen.getByText('document.processing_started')).toBeInTheDocument()
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
        reportedTotal: 250,
        computedTotal: 250,
        reconciles: true,
        transactionCount: 12,
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
    statements: [],
    auditEvents: [
      {
        id: 'audit_failed',
        eventType: 'document.failed',
        createdAt: '2026-05-06T14:06:00.000Z',
        actorUserId: 'user_123',
        requestId: 'req_failed',
        traceId: 'trace_failed',
      },
    ],
    deletionEvidence: null,
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
