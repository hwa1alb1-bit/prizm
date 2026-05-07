import { describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'
import { buildStatementExport, type StatementExportStore } from '@/lib/server/statement-export'

describe('statement export service', () => {
  it('streams standard CSV for reviewed ready statements and records export audit', async () => {
    const recordAudit = vi.fn().mockResolvedValue(true)
    const store = exportStore({ recordAudit })

    const result = await buildStatementExport({
      documentId: 'doc_123',
      format: 'csv',
      actorUserId: 'user_123',
      actorIp: null,
      actorUserAgent: null,
      routeContext: routeContext(),
      store,
    })

    expect(result).toMatchObject({
      ok: true,
      contentType: 'text/csv; charset=utf-8',
      filename: 'statement.csv',
    })
    expect(result.ok && result.body).toBe(
      'Date,Description,Debit,Credit,Amount,Balance\r\n2026-05-01,ACH Payroll,,2500,2500,3500\r\n',
    )
    expect(recordAudit).toHaveBeenCalledOnce()
  })

  it('blocks unreviewed statements before writing export audit', async () => {
    const recordAudit = vi.fn().mockResolvedValue(true)
    const store = exportStore({
      statement: { review_status: 'needs_review' },
      recordAudit,
    })

    const result = await buildStatementExport({
      documentId: 'doc_123',
      format: 'quickbooks_csv',
      actorUserId: 'user_123',
      actorIp: null,
      actorUserAgent: null,
      routeContext: routeContext(),
      store,
    })

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: 'PRZM_EXPORT_REVIEW_REQUIRED',
    })
    expect(recordAudit).not.toHaveBeenCalled()
  })

  it('streams XLSX with the canonical statement columns', async () => {
    const result = await buildStatementExport({
      documentId: 'doc_123',
      format: 'xlsx',
      actorUserId: 'user_123',
      actorIp: null,
      actorUserAgent: null,
      routeContext: routeContext(),
      store: exportStore(),
    })

    expect(result).toMatchObject({
      ok: true,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'statement.xlsx',
    })
    if (!result.ok || !(result.body instanceof Uint8Array)) {
      throw new Error('expected xlsx export bytes')
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(
      result.body.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    )
    const worksheet = workbook.getWorksheet('Statement')
    expect(worksheet?.getRow(1).values).toEqual([
      ,
      'Date',
      'Description',
      'Debit',
      'Credit',
      'Amount',
      'Balance',
    ])
    expect(worksheet?.getRow(2).values).toEqual([
      ,
      '2026-05-01',
      'ACH Payroll',
      '',
      '2500',
      '2500',
      '3500',
    ])
  })
})

function exportStore(
  overrides: {
    statement?: Partial<Awaited<ReturnType<StatementExportStore['getStatement']>>>
    recordAudit?: StatementExportStore['recordAudit']
  } = {},
): StatementExportStore {
  return {
    getWorkspaceIdForUser: vi.fn().mockResolvedValue('workspace_123'),
    getDocument: vi.fn().mockResolvedValue({
      id: 'doc_123',
      status: 'ready',
      expires_at: futureIso(),
      deleted_at: null,
      filename: 'statement.pdf',
    }),
    getStatement: vi.fn().mockResolvedValue({
      id: 'statement_123',
      review_status: 'reviewed',
      reconciles: true,
      transactions: [
        {
          id: 'txn_1',
          posted_at: '2026-05-01',
          description: 'ACH Payroll',
          amount: 2500,
          debit: null,
          credit: 2500,
          balance: 3500,
          needs_review: false,
        },
      ],
      expires_at: futureIso(),
      deleted_at: null,
      ...overrides.statement,
    }),
    recordAudit: overrides.recordAudit ?? vi.fn().mockResolvedValue(true),
  }
}

function routeContext() {
  return {
    requestId: 'req_export',
    traceId: '0123456789abcdef0123456789abcdef',
    pathname: '/api/v1/documents/doc_123/export',
  }
}

function futureIso(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString()
}
