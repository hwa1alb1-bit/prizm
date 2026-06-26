import { describe, expect, it } from 'vitest'
import {
  MARKETING_INTEGRATIONS,
  buildIntegrationSlugs,
  getIntegrationBySlug,
} from '@/lib/marketing/marketing-integrations'

describe('MARKETING_INTEGRATIONS', () => {
  it('exposes QuickBooks Online and Xero as the two launch integrations', () => {
    const slugs = MARKETING_INTEGRATIONS.map((entry) => entry.slug)
    expect(slugs).toEqual(['quickbooks-online', 'xero'])
  })

  it('provides an import-column mapping for each integration', () => {
    for (const integration of MARKETING_INTEGRATIONS) {
      expect(integration.importColumns.length).toBeGreaterThan(0)
      for (const column of integration.importColumns) {
        expect(column.name).toBeTruthy()
        expect(column.source).toBeTruthy()
      }
    }
  })
})

describe('buildIntegrationSlugs', () => {
  it('returns the two slugs for generateStaticParams', () => {
    expect(buildIntegrationSlugs()).toHaveLength(2)
  })
})

describe('getIntegrationBySlug', () => {
  it('round-trips known slugs', () => {
    expect(getIntegrationBySlug('quickbooks-online')?.name).toBe('QuickBooks Online')
    expect(getIntegrationBySlug('xero')?.name).toBe('Xero')
  })

  it('returns undefined for unknown slugs', () => {
    expect(getIntegrationBySlug('sage')).toBeUndefined()
  })
})
