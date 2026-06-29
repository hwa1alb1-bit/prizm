import { describe, expect, it } from 'vitest'
import { exportActionsFor } from '@/components/app/document-history'
import type { StatementEvidenceView } from '@/lib/server/document-history'

function statement(overrides: Partial<StatementEvidenceView> = {}): StatementEvidenceView {
  return {
    id: 'stmt_1',
    revision: 1,
    statementType: 'bank',
    statementMetadata: {},
    reviewStatus: 'reviewed',
    bankName: null,
    accountLast4: null,
    periodStart: null,
    periodEnd: null,
    openingBalance: null,
    closingBalance: null,
    reportedTotal: null,
    computedTotal: null,
    reconciles: null,
    reconciliationReport: null,
    transactionCount: 0,
    transactions: [],
    createdAt: '2026-05-01T00:00:00.000Z',
    expiresAt: '2026-06-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

describe('exportActionsFor', () => {
  it('returns the four supported export formats in CSV, XLSX, QuickBooks, Xero order for reviewed statements', () => {
    expect(exportActionsFor(statement())).toEqual([
      { format: 'csv' },
      { format: 'xlsx' },
      { format: 'quickbooks_csv' },
      { format: 'xero_csv' },
    ])
  })

  it('returns no actions when the statement has not been reviewed', () => {
    expect(exportActionsFor(statement({ reviewStatus: 'needs_review' }))).toEqual([])
    expect(exportActionsFor(statement({ reviewStatus: null }))).toEqual([])
  })
})
