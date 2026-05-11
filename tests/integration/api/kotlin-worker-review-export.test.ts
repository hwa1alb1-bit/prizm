import { describe, expect, it, vi } from 'vitest'
import kotlinCreditCardFixture from '../../fixtures/kotlin-worker/credit-card-statement-response.json'
import { createKotlinWorkerExtractionEngine } from '@/lib/server/extraction-engine'
import { applyStatementEdit, type StatementEditStore } from '@/lib/server/statement-edit'
import { buildStatementExport, type StatementExportStore } from '@/lib/server/statement-export'
import type { Json } from '@/lib/shared/db-types'

describe('Kotlin worker review to export flow', () => {
  it('exports reviewed CSV from a known worker fixture after reviewer row edits', async () => {
    const extraction = await createKotlinWorkerExtractionEngine({
      worker: {
        start: vi.fn(),
        poll: vi.fn().mockResolvedValue(kotlinCreditCardFixture),
      },
    }).poll({ jobId: 'worker_card_123' })

    if (extraction.status !== 'succeeded') {
      throw new Error('expected worker fixture to produce a normalized statement')
    }

    const workerStatement = extraction.statements[0]
    if (!workerStatement) throw new Error('expected one worker statement')

    let reviewedTransactions: Json[] = []
    const updateStatement = vi
      .fn<StatementEditStore['updateStatement']>()
      .mockImplementation(async (_statementId, _expectedRevision, patch) => {
        reviewedTransactions = patch.transactions
        return 'updated'
      })

    const reviewResult = await applyStatementEdit({
      documentId: 'doc_worker_card',
      actorUserId: 'user_123',
      expectedRevision: 0,
      reviewed: true,
      statement: {
        statementType: workerStatement.statementType,
        statementMetadata: workerStatement.metadata,
        bankName: workerStatement.bankName,
        accountLast4: workerStatement.accountLast4,
        periodStart: workerStatement.periodStart,
        periodEnd: workerStatement.periodEnd,
        openingBalance: workerStatement.openingBalance,
        closingBalance: workerStatement.closingBalance,
        reportedTotal: workerStatement.reportedTotal,
      },
      operations: [
        {
          type: 'update',
          id: 'row_1',
          patch: {
            description: 'Corrected Grocery Market',
            needsReview: false,
            reviewReason: null,
          },
        },
      ],
      actorIp: '203.0.113.10',
      actorUserAgent: 'vitest',
      routeContext: routeContext('/api/v1/documents/doc_worker_card/statement'),
      store: statementEditStore({
        statement: {
          statement_type: workerStatement.statementType,
          statement_metadata: workerStatement.metadata,
          bank_name: workerStatement.bankName,
          account_last4: workerStatement.accountLast4,
          period_start: workerStatement.periodStart,
          period_end: workerStatement.periodEnd,
          opening_balance: workerStatement.openingBalance,
          closing_balance: workerStatement.closingBalance,
          reported_total: workerStatement.reportedTotal,
          computed_total: workerStatement.computedTotal,
          reconciles: workerStatement.reconciles,
          transactions: workerStatement.transactions as unknown as Json,
        },
        updateStatement,
      }),
    })

    expect(reviewResult).toMatchObject({
      ok: true,
      reviewStatus: 'reviewed',
    })
    expect(updateStatement).toHaveBeenCalledWith(
      'statement_worker_card',
      0,
      expect.objectContaining({
        review_status: 'reviewed',
        transactions: expect.arrayContaining([
          expect.objectContaining({
            id: 'row_1',
            posted_at: '2026-04-05',
            description: 'Corrected Grocery Market',
            needs_review: false,
          }),
        ]),
      }),
    )

    const exportResult = await buildStatementExport({
      documentId: 'doc_worker_card',
      format: 'csv',
      actorUserId: 'user_123',
      actorIp: '203.0.113.10',
      actorUserAgent: 'vitest',
      routeContext: routeContext('/api/v1/documents/doc_worker_card/export'),
      store: statementExportStore({
        statement: {
          statement_type: workerStatement.statementType,
          review_status: 'reviewed',
          reconciles: true,
          transactions: reviewedTransactions,
        },
      }),
    })

    expect(exportResult).toMatchObject({
      ok: true,
      contentType: 'text/csv; charset=utf-8',
      filename: 'worker-card.csv',
    })
    expect(exportResult.ok && exportResult.body).toBe(
      'Date,Description,Debit,Credit,Amount,Balance\r\n2026-04-05,Corrected Grocery Market,414.75,,-414.75,\r\n2026-04-20,Payment Thank You,,50,50,\r\n',
    )
  })
})

function statementEditStore({
  statement,
  updateStatement,
}: {
  statement: Partial<Awaited<ReturnType<StatementEditStore['getStatement']>>>
  updateStatement: StatementEditStore['updateStatement']
}): StatementEditStore {
  return {
    getUserProfile: vi.fn().mockResolvedValue({ workspaceId: 'workspace_123', role: 'member' }),
    getDocument: vi.fn().mockResolvedValue({
      id: 'doc_worker_card',
      status: 'ready',
      expires_at: futureIso(),
      deleted_at: null,
    }),
    getStatement: vi.fn().mockResolvedValue({
      id: 'statement_worker_card',
      revision: 0,
      review_status: 'unreviewed',
      expires_at: futureIso(),
      deleted_at: null,
      ...statement,
    }),
    updateStatement,
    recordAudit: vi.fn().mockResolvedValue(true),
  }
}

function statementExportStore({
  statement,
}: {
  statement: Partial<Awaited<ReturnType<StatementExportStore['getStatement']>>>
}): StatementExportStore {
  return {
    getWorkspaceIdForUser: vi.fn().mockResolvedValue('workspace_123'),
    getDocument: vi.fn().mockResolvedValue({
      id: 'doc_worker_card',
      status: 'ready',
      expires_at: futureIso(),
      deleted_at: null,
      filename: 'worker-card.pdf',
    }),
    getStatement: vi.fn().mockResolvedValue({
      id: 'statement_worker_card',
      expires_at: futureIso(),
      deleted_at: null,
      ...statement,
    }),
    recordAudit: vi.fn().mockResolvedValue(true),
  }
}

function routeContext(pathname: string) {
  return {
    requestId: 'req_worker_review',
    traceId: '0123456789abcdef0123456789abcdef',
    pathname,
  }
}

function futureIso(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString()
}
