import { describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'
import {
  buildStatementExport,
  createStatementExportArtifact,
  getStatementExportDownload,
  type StatementExportArtifactStore,
  type StatementExportDownloadStore,
  type StatementExportObjectStore,
  type StatementExportStore,
} from '@/lib/server/statement-export'

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

  it.each([
    [
      'csv' as const,
      'Date,Description,Debit,Credit,Amount,Balance\r\n2026-04-03,Grocery Market,125.45,,-125.45,\r\n2026-04-15,Thank You Payment,,500,500,\r\n2026-04-20,Late Payment Fee,29,,-29,\r\n2026-04-30,Interest Charge Purchases,12.75,,-12.75,\r\n2026-04-30,Rewards Statement Credit,,1,1,\r\n',
    ],
    [
      'quickbooks_csv' as const,
      'Date,Description,Amount\r\n2026-04-03,Grocery Market,-125.45\r\n2026-04-15,Thank You Payment,500\r\n2026-04-20,Late Payment Fee,-29\r\n2026-04-30,Interest Charge Purchases,-12.75\r\n2026-04-30,Rewards Statement Credit,1\r\n',
    ],
    [
      'xero_csv' as const,
      'Date,Amount,Payee,Description,Reference\r\n2026-04-03,-125.45,Grocery Market,Grocery Market,cc_txn_purchase\r\n2026-04-15,500,Thank You Payment,Thank You Payment,cc_txn_payment\r\n2026-04-20,-29,Late Payment Fee,Late Payment Fee,cc_txn_fee\r\n2026-04-30,-12.75,Interest Charge Purchases,Interest Charge Purchases,cc_txn_interest\r\n2026-04-30,1,Rewards Statement Credit,Rewards Statement Credit,cc_txn_rewards\r\n',
    ],
  ])(
    'streams %s with credit-card debit rows negative and credit rows positive',
    async (format, body) => {
      const result = await buildStatementExport({
        documentId: 'doc_123',
        format,
        actorUserId: 'user_123',
        actorIp: null,
        actorUserAgent: null,
        routeContext: routeContext(),
        store: exportStore({
          statement: {
            statement_type: 'credit_card',
            transactions: creditCardTransactions(),
          },
        }),
      })

      expect(result).toMatchObject({ ok: true })
      expect(result.ok && result.body).toBe(body)
    },
  )

  it('keeps bank statement exports unchanged when an amount is already present', async () => {
    const result = await buildStatementExport({
      documentId: 'doc_123',
      format: 'quickbooks_csv',
      actorUserId: 'user_123',
      actorIp: null,
      actorUserAgent: null,
      routeContext: routeContext(),
      store: exportStore({
        statement: {
          transactions: [
            {
              id: 'txn_bank_outflow',
              posted_at: '2026-05-02',
              description: 'Bank service fee',
              amount: 10,
              debit: 10,
              credit: null,
              needs_review: false,
            },
          ],
        },
      }),
    })

    expect(result.ok && result.body).toBe(
      'Date,Description,Amount\r\n2026-05-02,Bank service fee,10\r\n',
    )
  })
})

describe('statement export artifacts', () => {
  it('stores a reviewed ready CSV export artifact with retention and generation audit', async () => {
    const createArtifact = vi.fn().mockResolvedValue({ id: 'export_123' })
    const recordAudit = vi.fn().mockResolvedValue(true)
    const putObject = vi.fn().mockResolvedValue(undefined)

    const result = await createStatementExportArtifact({
      documentId: 'doc_123',
      format: 'csv',
      actorUserId: 'user_123',
      actorIp: '203.0.113.10',
      actorUserAgent: 'vitest',
      routeContext: routeContext(),
      idFactory: () => 'export_123',
      store: exportArtifactStore({ createArtifact, recordAudit }),
      objectStore: exportObjectStore({ putObject }),
    })

    expect(result).toMatchObject({
      ok: true,
      exportId: 'export_123',
      documentId: 'doc_123',
      format: 'csv',
      filename: 'statement.csv',
      contentType: 'text/csv; charset=utf-8',
      expiresAt: expect.any(String),
    })
    expect(putObject).toHaveBeenCalledWith({
      bucket: 'prizm-uploads-test',
      key: 'workspace_123/exports/doc_123/export_123.csv',
      body: 'Date,Description,Debit,Credit,Amount,Balance\r\n2026-05-01,ACH Payroll,,2500,2500,3500\r\n',
      contentType: 'text/csv; charset=utf-8',
    })
    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'export_123',
        workspaceId: 'workspace_123',
        documentId: 'doc_123',
        statementId: 'statement_123',
        format: 'csv',
        filename: 'statement.csv',
        s3Bucket: 'prizm-uploads-test',
        s3Key: 'workspace_123/exports/doc_123/export_123.csv',
        contentType: 'text/csv; charset=utf-8',
        expiresAt: expect.any(String),
        byteSize: 86,
        checksumSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        actorUserId: 'user_123',
        requestId: 'req_export',
        traceId: '0123456789abcdef0123456789abcdef',
      }),
    )
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'export.generated',
        workspaceId: 'workspace_123',
        actorUserId: 'user_123',
        documentId: 'doc_123',
        exportId: 'export_123',
        format: 'csv',
      }),
    )
  })

  it('returns a short-lived signed download URL and audits the download', async () => {
    const getSignedDownloadUrl = vi
      .fn()
      .mockResolvedValue('https://signed.example/exports/export_123.csv')
    const recordAudit = vi.fn().mockResolvedValue(true)

    const result = await getStatementExportDownload({
      exportId: 'export_123',
      actorUserId: 'user_123',
      actorIp: '203.0.113.10',
      actorUserAgent: 'vitest',
      routeContext: routeContext('/api/v1/exports/export_123/download'),
      store: exportDownloadStore({ recordAudit }),
      objectStore: exportObjectStore({ getSignedDownloadUrl }),
    })

    expect(result).toEqual({
      ok: true,
      exportId: 'export_123',
      downloadUrl: 'https://signed.example/exports/export_123.csv',
      expiresInSeconds: 300,
      requestId: 'req_export',
      traceId: '0123456789abcdef0123456789abcdef',
    })
    expect(getSignedDownloadUrl).toHaveBeenCalledWith({
      bucket: 'prizm-uploads-test',
      key: 'workspace_123/exports/doc_123/export_123.csv',
      filename: 'statement.csv',
      contentType: 'text/csv; charset=utf-8',
      expiresInSeconds: 300,
    })
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'export.downloaded',
        workspaceId: 'workspace_123',
        actorUserId: 'user_123',
        documentId: 'doc_123',
        exportId: 'export_123',
        format: 'csv',
      }),
    )
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

function exportArtifactStore(
  overrides: {
    statement?: Partial<Awaited<ReturnType<StatementExportArtifactStore['getStatement']>>>
    createArtifact?: StatementExportArtifactStore['createArtifact']
    recordAudit?: StatementExportArtifactStore['recordAudit']
  } = {},
): StatementExportArtifactStore {
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
      statement_type: 'bank',
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
    createArtifact: overrides.createArtifact ?? vi.fn().mockResolvedValue({ id: 'export_123' }),
    recordAudit: overrides.recordAudit ?? vi.fn().mockResolvedValue(true),
  }
}

function exportObjectStore(
  overrides: {
    putObject?: StatementExportObjectStore['putObject']
    getSignedDownloadUrl?: StatementExportObjectStore['getSignedDownloadUrl']
  } = {},
): StatementExportObjectStore {
  return {
    getExportBucket: vi.fn().mockReturnValue('prizm-uploads-test'),
    putObject: overrides.putObject ?? vi.fn().mockResolvedValue(undefined),
    getSignedDownloadUrl:
      overrides.getSignedDownloadUrl ??
      vi.fn().mockResolvedValue('https://signed.example/export_123.csv'),
  }
}

function exportDownloadStore(
  overrides: {
    artifact?: Partial<Awaited<ReturnType<StatementExportDownloadStore['getArtifact']>>>
    recordAudit?: StatementExportDownloadStore['recordAudit']
  } = {},
): StatementExportDownloadStore {
  return {
    getWorkspaceIdForUser: vi.fn().mockResolvedValue('workspace_123'),
    getArtifact: vi.fn().mockResolvedValue({
      id: 'export_123',
      workspace_id: 'workspace_123',
      document_id: 'doc_123',
      statement_id: 'statement_123',
      format: 'csv',
      filename: 'statement.csv',
      s3_bucket: 'prizm-uploads-test',
      s3_key: 'workspace_123/exports/doc_123/export_123.csv',
      content_type: 'text/csv; charset=utf-8',
      expires_at: futureIso(),
      deleted_at: null,
      ...overrides.artifact,
    }),
    recordAudit: overrides.recordAudit ?? vi.fn().mockResolvedValue(true),
  }
}

function creditCardTransactions() {
  return [
    {
      id: 'cc_txn_purchase',
      posted_at: '2026-04-03',
      description: 'Grocery Market',
      amount: 125.45,
      debit: 125.45,
      credit: null,
      needs_review: false,
    },
    {
      id: 'cc_txn_payment',
      posted_at: '2026-04-15',
      description: 'Thank You Payment',
      amount: 500,
      debit: null,
      credit: 500,
      needs_review: false,
    },
    {
      id: 'cc_txn_fee',
      posted_at: '2026-04-20',
      description: 'Late Payment Fee',
      amount: 29,
      debit: 29,
      credit: null,
      needs_review: false,
    },
    {
      id: 'cc_txn_interest',
      posted_at: '2026-04-30',
      description: 'Interest Charge Purchases',
      amount: 12.75,
      debit: 12.75,
      credit: null,
      needs_review: false,
    },
    {
      id: 'cc_txn_rewards',
      posted_at: '2026-04-30',
      description: 'Rewards Statement Credit',
      amount: 1,
      debit: null,
      credit: 1,
      needs_review: false,
    },
  ]
}

function routeContext(pathname = '/api/v1/documents/doc_123/export') {
  return {
    requestId: 'req_export',
    traceId: '0123456789abcdef0123456789abcdef',
    pathname,
  }
}

function futureIso(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString()
}
