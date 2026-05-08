import { describe, expect, it, vi } from 'vitest'
import { applyStatementEdit, type StatementEditStore } from '@/lib/server/statement-edit'

describe('statement edit service', () => {
  it('blocks mark reviewed when required statement evidence or row review is unresolved', async () => {
    const updateStatement = vi.fn().mockResolvedValue('updated')
    const recordAudit = vi.fn().mockResolvedValue(true)
    const store: StatementEditStore = {
      getUserProfile: vi.fn().mockResolvedValue({ workspaceId: 'workspace_123', role: 'member' }),
      getDocument: vi.fn().mockResolvedValue({
        id: 'doc_123',
        status: 'ready',
        expires_at: futureIso(),
        deleted_at: null,
      }),
      getStatement: vi.fn().mockResolvedValue({
        id: 'statement_123',
        statement_type: 'bank',
        statement_metadata: {},
        bank_name: null,
        account_last4: '1234',
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        opening_balance: 100,
        closing_balance: 90,
        reported_total: -10,
        computed_total: -10,
        reconciles: true,
        transactions: [
          {
            id: 'txn_needs_review',
            posted_at: '2026-05-02',
            description: 'Unclear row',
            amount: -10,
            needs_review: true,
          },
        ],
        revision: 3,
        review_status: 'unreviewed',
        expires_at: futureIso(),
        deleted_at: null,
      }),
      updateStatement,
      recordAudit,
    }

    const result = await applyStatementEdit({
      documentId: 'doc_123',
      actorUserId: 'user_123',
      expectedRevision: 3,
      reviewed: true,
      operations: [],
      actorIp: '203.0.113.10',
      actorUserAgent: 'vitest',
      routeContext: {
        requestId: 'req_statement',
        traceId: '0123456789abcdef0123456789abcdef',
        pathname: '/api/v1/documents/doc_123/statement',
      },
      store,
    })

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: 'PRZM_STATEMENT_REVIEW_BLOCKED',
    })
    expect(updateStatement).not.toHaveBeenCalled()
    expect(recordAudit).not.toHaveBeenCalled()
  })

  it('applies statement metadata edits, recomputes reconciliation, and audits review completion', async () => {
    const updateStatement = vi.fn().mockResolvedValue('updated')
    const recordAudit = vi.fn().mockResolvedValue(true)
    const store: StatementEditStore = {
      getUserProfile: vi.fn().mockResolvedValue({ workspaceId: 'workspace_123', role: 'member' }),
      getDocument: vi.fn().mockResolvedValue({
        id: 'doc_123',
        status: 'ready',
        expires_at: futureIso(),
        deleted_at: null,
      }),
      getStatement: vi.fn().mockResolvedValue({
        id: 'statement_123',
        statement_type: 'bank',
        statement_metadata: { reviewerNote: 'OCR draft' },
        bank_name: 'Acme Bnk',
        account_last4: '1234',
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        opening_balance: 100,
        closing_balance: 125,
        reported_total: 25,
        computed_total: 10,
        reconciles: false,
        transactions: [
          {
            id: 'txn_1',
            posted_at: '2026-05-02',
            description: 'Deposit',
            amount: 10,
            needs_review: false,
          },
        ],
        revision: 3,
        review_status: 'unreviewed',
        expires_at: futureIso(),
        deleted_at: null,
      }),
      updateStatement,
      recordAudit,
    }

    const result = await applyStatementEdit({
      documentId: 'doc_123',
      actorUserId: 'user_123',
      expectedRevision: 3,
      reviewed: true,
      statement: {
        bankName: 'Acme Bank',
        statementMetadata: { reviewerNote: 'Verified against page 1' },
      },
      operations: [{ type: 'update', id: 'txn_1', patch: { amount: 25 } }],
      actorIp: '203.0.113.10',
      actorUserAgent: 'vitest',
      routeContext: {
        requestId: 'req_statement',
        traceId: '0123456789abcdef0123456789abcdef',
        pathname: '/api/v1/documents/doc_123/statement',
      },
      store,
    })

    expect(result).toMatchObject({
      ok: true,
      revision: 4,
      reviewStatus: 'reviewed',
    })
    expect(updateStatement).toHaveBeenCalledWith(
      'statement_123',
      3,
      expect.objectContaining({
        bank_name: 'Acme Bank',
        statement_metadata: { reviewerNote: 'Verified against page 1' },
        reported_total: 25,
        computed_total: 25,
        reconciles: true,
        review_status: 'reviewed',
      }),
    )
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'statement.reviewed',
        metadataChanged: true,
        operationCount: 1,
      }),
    )
  })

  it('applies transaction update, add, delete, and reviewed state with a revision bump', async () => {
    const updateStatement = vi.fn().mockResolvedValue('updated')
    const store: StatementEditStore = {
      getUserProfile: vi.fn().mockResolvedValue({ workspaceId: 'workspace_123', role: 'member' }),
      getDocument: vi.fn().mockResolvedValue({
        id: 'doc_123',
        status: 'ready',
        expires_at: futureIso(),
        deleted_at: null,
      }),
      getStatement: vi.fn().mockResolvedValue({
        id: 'statement_123',
        statement_type: 'bank',
        statement_metadata: {},
        bank_name: 'PRIZM Bank',
        account_last4: '1234',
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        opening_balance: 100,
        closing_balance: 113,
        reported_total: 13,
        computed_total: -24,
        reconciles: true,
        transactions: [
          { id: 'txn_keep', posted_at: '2026-05-01', description: 'Old memo', amount: -12 },
          { id: 'txn_delete', posted_at: '2026-05-02', description: 'Duplicate', amount: -12 },
        ],
        revision: 3,
        review_status: 'needs_review',
        expires_at: futureIso(),
        deleted_at: null,
      }),
      updateStatement,
      recordAudit: vi.fn().mockResolvedValue(true),
    }

    const result = await applyStatementEdit({
      documentId: 'doc_123',
      actorUserId: 'user_123',
      expectedRevision: 3,
      reviewed: true,
      operations: [
        { type: 'update', id: 'txn_keep', patch: { description: 'Correct memo' } },
        {
          type: 'add',
          row: { id: 'txn_added', postedAt: '2026-05-03', description: 'New row', amount: 25 },
        },
        { type: 'delete', id: 'txn_delete' },
      ],
      actorIp: '203.0.113.10',
      actorUserAgent: 'vitest',
      routeContext: {
        requestId: 'req_statement',
        traceId: '0123456789abcdef0123456789abcdef',
        pathname: '/api/v1/documents/doc_123/statement',
      },
      store,
    })

    expect(result).toMatchObject({
      ok: true,
      revision: 4,
      reviewStatus: 'reviewed',
    })
    expect(updateStatement).toHaveBeenCalledWith(
      'statement_123',
      3,
      expect.objectContaining({
        revision: 4,
        review_status: 'reviewed',
        transactions: [
          expect.objectContaining({ id: 'txn_keep', description: 'Correct memo' }),
          expect.objectContaining({ id: 'txn_added', posted_at: '2026-05-03' }),
        ],
      }),
    )
  })
})

function futureIso(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString()
}
