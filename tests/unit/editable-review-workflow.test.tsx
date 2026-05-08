import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditableReviewWorkflow } from '@/components/app/editable-review-workflow'
import type { StatementEvidenceView } from '@/lib/server/document-history'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

describe('EditableReviewWorkflow', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          revision: 5,
          reviewStatus: 'unreviewed',
        }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves statement metadata and edited transaction rows through the statement PATCH route', async () => {
    const user = userEvent.setup()
    render(<EditableReviewWorkflow documentId="doc_123" statement={statement()} exceptions={[]} />)

    await user.clear(screen.getByLabelText('Bank name'))
    await user.type(screen.getByLabelText('Bank name'), 'Acme Bank')
    await user.clear(screen.getByLabelText('Row 1 description'))
    await user.type(screen.getByLabelText('Row 1 description'), 'Corrected deposit')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledOnce())
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/documents/doc_123/statement',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: 4,
          reviewed: false,
          statement: {
            statementType: 'bank',
            bankName: 'Acme Bank',
            accountLast4: '1234',
            periodStart: '2026-05-01',
            periodEnd: '2026-05-31',
            openingBalance: 100,
            closingBalance: 125,
            reportedTotal: 25,
            statementMetadata: {},
          },
          operations: [
            {
              type: 'update',
              id: 'txn_1',
              patch: {
                postedAt: '2026-05-02',
                description: 'Corrected deposit',
                amount: 25,
                debit: null,
                credit: 25,
                balance: 125,
                needsReview: false,
                reviewReason: null,
              },
            },
          ],
        }),
      }),
    )
    expect(refreshMock).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('Draft saved')
  })

  it('posts reviewed only after required fields, rows, and reconciliation are clean', async () => {
    const user = userEvent.setup()
    render(<EditableReviewWorkflow documentId="doc_123" statement={statement()} exceptions={[]} />)

    await user.click(screen.getByRole('button', { name: 'Mark reviewed' }))

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledOnce())
    expect(JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body))).toMatchObject({
      expectedRevision: 4,
      reviewed: true,
    })
  })

  it('shows failed-save recovery when the PATCH route returns a problem response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          detail: 'Refresh the statement before editing.',
        }),
      }),
    )
    const user = userEvent.setup()
    render(<EditableReviewWorkflow documentId="doc_123" statement={statement()} exceptions={[]} />)

    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Refresh the statement before editing.',
    )
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('keeps mark reviewed disabled while invalid rows or unresolved exceptions remain', () => {
    render(
      <EditableReviewWorkflow
        documentId="doc_123"
        statement={{
          ...statement(),
          transactions: [
            {
              ...statement().transactions[0]!,
              needsReview: true,
              reviewReason: 'Amount was unclear.',
            },
          ],
        }}
        exceptions={[
          {
            id: 'transaction:txn_1',
            title: 'Transaction row 1',
            cause: 'Amount was unclear.',
          },
        ]}
      />,
    )

    expect(screen.getByRole('button', { name: 'Mark reviewed' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Review blocked')
    expect(screen.getByText('Transaction row 1')).toBeInTheDocument()
  })
})

function statement(): StatementEvidenceView & { revision: number } {
  return {
    id: 'statement_123',
    revision: 4,
    statementType: 'bank',
    statementMetadata: {},
    reviewStatus: 'unreviewed',
    bankName: 'Acme Bnk',
    accountLast4: '1234',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    openingBalance: 100,
    closingBalance: 125,
    reportedTotal: 25,
    computedTotal: 25,
    reconciles: true,
    transactionCount: 1,
    transactions: [
      {
        id: 'txn_1',
        postedAt: '2026-05-02',
        description: 'Deposit',
        amount: 25,
        debit: null,
        credit: 25,
        balance: 125,
        confidence: 0.98,
        source: 'page_1_row_2',
        needsReview: false,
        reviewReason: null,
      },
    ],
    createdAt: '2026-05-08T12:00:00.000Z',
    expiresAt: '2030-05-08T12:00:00.000Z',
    deletedAt: null,
  }
}
