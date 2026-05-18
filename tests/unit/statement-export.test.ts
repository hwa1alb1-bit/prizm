import { describe, expect, it, vi } from 'vitest'
import { buildStatementExport, type StatementExportStore } from '@/lib/server/statement-export'

describe('buildStatementExport', () => {
  it('neutralizes spreadsheet formula payloads in exported CSV cells', async () => {
    const store = createStore({
      transactions: [
        {
          posted_at: '2026-05-01',
          amount: '-25.50',
          payee: '+ACME Supplies',
          description: '=cmd|/C calc!A0',
          reference: '@wire-123',
        },
      ],
    })

    const result = await buildStatementExport({
      documentId: 'doc_123',
      format: 'xero_csv',
      actorUserId: 'user_123',
      actorIp: '203.0.113.10',
      actorUserAgent: 'vitest',
      routeContext: {
        requestId: 'req_export',
        traceId: '0123456789abcdef0123456789abcdef',
        pathname: '/api/v1/documents/doc_123/export',
      },
      store,
    })

    expect(result.ok).toBe(true)
    expect(result.ok ? result.body : '').toBe(
      "Date,Amount,Payee,Description,Reference\r\n2026-05-01,-25.50,'+ACME Supplies,'=cmd|/C calc!A0,'@wire-123\r\n",
    )
    expect(store.recordAudit).toHaveBeenCalled()
  })
})

function createStore(input: { transactions: unknown[] }): StatementExportStore {
  return {
    getWorkspaceIdForUser: vi.fn().mockResolvedValue('workspace_123'),
    getDocument: vi.fn().mockResolvedValue({
      id: 'doc_123',
      status: 'ready',
      expires_at: '2099-01-01T00:00:00.000Z',
      deleted_at: null,
      filename: 'statement.pdf',
    }),
    getStatement: vi.fn().mockResolvedValue({
      id: 'stmt_123',
      statement_type: 'bank',
      review_status: 'reviewed',
      reconciles: true,
      transactions: input.transactions,
      expires_at: '2099-01-01T00:00:00.000Z',
      deleted_at: null,
    }),
    recordAudit: vi.fn().mockResolvedValue(true),
  }
}
