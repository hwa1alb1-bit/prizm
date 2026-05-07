import { describe, expect, it, vi } from 'vitest'
import { applyStatementEdit, type StatementEditStore } from '@/lib/server/statement-edit'

describe('statement edit service', () => {
  it('applies transaction update, add, delete, and reviewed state with a revision bump', async () => {
    const updateStatement = vi.fn().mockResolvedValue(true)
    const store: StatementEditStore = {
      getWorkspaceIdForUser: vi.fn().mockResolvedValue('workspace_123'),
      getDocument: vi.fn().mockResolvedValue({
        id: 'doc_123',
        status: 'ready',
        expires_at: futureIso(),
        deleted_at: null,
      }),
      getStatement: vi.fn().mockResolvedValue({
        id: 'statement_123',
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
