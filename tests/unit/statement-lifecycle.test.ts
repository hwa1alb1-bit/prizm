import { describe, expect, it, vi } from 'vitest'
import { applyStatementEdit, type StatementEditStore } from '@/lib/server/statement-edit'

describe('statement lifecycle edits', () => {
  it('keeps ordinary saved edits in the unreviewed review state', async () => {
    const store = createStore()

    const result = await applyStatementEdit({ ...statementInput(), store })

    expect(result).toMatchObject({
      ok: true,
      reviewStatus: 'unreviewed',
      revision: 3,
    })
    expect(store.updateStatement).toHaveBeenCalledWith('stmt_123', 2, {
      workspaceId: 'workspace_123',
      documentId: 'doc_123',
      transactions: [expect.objectContaining({ id: 'txn_1', description: 'New memo' })],
      revision: 3,
      review_status: 'unreviewed',
      edited_by: 'user_123',
      edited_at: expect.any(String),
    })
  })

  it('rejects viewer edits before touching statement rows', async () => {
    const store = createStore({ role: 'viewer' })

    const result = await applyStatementEdit({ ...statementInput(), store })

    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: 'PRZM_AUTH_FORBIDDEN',
    })
    expect(store.getDocument).not.toHaveBeenCalled()
    expect(store.updateStatement).not.toHaveBeenCalled()
  })

  it('returns a revision conflict when the atomic update no longer matches', async () => {
    const store = createStore()
    store.updateStatement.mockResolvedValueOnce('revision_conflict')

    const result = await applyStatementEdit({ ...statementInput(), store })

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: 'PRZM_STATEMENT_REVISION_CONFLICT',
    })
    expect(store.recordAudit).not.toHaveBeenCalled()
  })

  it('treats lifecycle changes between the read and write as a stale edit', async () => {
    const store = createStore()
    store.updateStatement.mockResolvedValueOnce('revision_conflict')

    const result = await applyStatementEdit({ ...statementInput(), store })

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: 'PRZM_STATEMENT_REVISION_CONFLICT',
    })
    expect(store.updateStatement).toHaveBeenCalledWith(
      'stmt_123',
      2,
      expect.objectContaining({
        workspaceId: 'workspace_123',
        documentId: 'doc_123',
      }),
    )
  })
})

function statementInput() {
  return {
    documentId: 'doc_123',
    actorUserId: 'user_123',
    expectedRevision: 2,
    operations: [{ type: 'update' as const, id: 'txn_1', patch: { description: 'New memo' } }],
    actorIp: '203.0.113.10',
    actorUserAgent: 'vitest',
    routeContext: {
      requestId: 'req_statement',
      traceId: '0123456789abcdef0123456789abcdef',
      pathname: '/api/v1/documents/doc_123/statement',
    },
  }
}

function createStore(overrides: { role?: string } = {}) {
  return {
    getUserProfile: vi.fn().mockResolvedValue({
      workspaceId: 'workspace_123',
      role: overrides.role ?? 'member',
    }),
    getDocument: vi.fn().mockResolvedValue({
      id: 'doc_123',
      status: 'ready',
      expires_at: activeExpiry(),
      deleted_at: null,
    }),
    getStatement: vi.fn().mockResolvedValue({
      id: 'stmt_123',
      transactions: [{ id: 'txn_1', description: 'Old memo' }],
      revision: 2,
      review_status: 'unreviewed',
      expires_at: activeExpiry(),
      deleted_at: null,
    }),
    updateStatement: vi.fn().mockResolvedValue('updated'),
    recordAudit: vi.fn().mockResolvedValue(true),
  } satisfies StatementEditStore
}

function activeExpiry() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}
