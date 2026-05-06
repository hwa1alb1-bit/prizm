import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  DocumentHistoryList,
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
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Acme Bank')).toBeInTheDocument()
    expect(screen.getByText('document.ready')).toBeInTheDocument()
    expect(screen.getByText('Receipt sent')).toBeInTheDocument()
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
