/**
 * Marketing-only downstream software catalog for /integrate/[slug] programmatic
 * SEO pages. Each entry describes the import format StatementStudio exports for
 * that accounting tool and the column mapping a bookkeeper sees on import.
 *
 * Source of truth for what each CSV actually contains lives next to the export
 * code paths; this file is presentational and must be kept in sync if column
 * names change in the export pipeline.
 */

export type MarketingIntegrationSlug = 'quickbooks-online' | 'xero'

export type ImportColumn = {
  name: string
  source: string
}

export type MarketingIntegration = {
  slug: MarketingIntegrationSlug
  name: string
  format: string
  importColumns: ReadonlyArray<ImportColumn>
}

export const MARKETING_INTEGRATIONS: ReadonlyArray<MarketingIntegration> = [
  {
    slug: 'quickbooks-online',
    name: 'QuickBooks Online',
    format: 'QuickBooks-mapped CSV (3 or 4 columns)',
    importColumns: [
      { name: 'Date', source: 'Transaction date from the PDF statement row' },
      { name: 'Description', source: 'Cleaned merchant + memo string' },
      { name: 'Amount', source: 'Signed amount (debit negative, credit positive)' },
    ],
  },
  {
    slug: 'xero',
    name: 'Xero',
    format: 'Xero bank-statement CSV',
    importColumns: [
      { name: '*Date', source: 'Transaction date in DD/MM/YYYY format' },
      { name: '*Amount', source: 'Signed amount (debit negative, credit positive)' },
      { name: 'Payee', source: 'Cleaned merchant string' },
      { name: 'Description', source: 'Memo + reference appended' },
      { name: 'Reference', source: 'Bank-supplied reference when present' },
    ],
  },
] as const

export function buildIntegrationSlugs(): MarketingIntegrationSlug[] {
  return MARKETING_INTEGRATIONS.map((integration) => integration.slug)
}

export function getIntegrationBySlug(slug: string): MarketingIntegration | undefined {
  return MARKETING_INTEGRATIONS.find((integration) => integration.slug === slug)
}
