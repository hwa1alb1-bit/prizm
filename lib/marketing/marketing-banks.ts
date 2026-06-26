/**
 * Marketing-only bank catalog for /bank/[slug] programmatic SEO pages.
 *
 * Distinct from `lib/marketing/supported-issuers.ts`, which mirrors the Kotlin
 * IssuerDetector and only lists banks the extractor has a native adapter for.
 * This list is broader: it captures the long-tail US consumer bank universe
 * for search intent, with an honest engineStatus so each landing page can
 * disclose whether a native parser exists or the GENERIC fallback runs.
 *
 * When the Kotlin extractor adds a new native adapter, flip the matching
 * entry from 'generic-fallback' to 'native' in the same PR that ships the
 * adapter (per the wire-contract invariant).
 */

export type MarketingBankSlug =
  | 'chase'
  | 'bank-of-america'
  | 'wells-fargo'
  | 'capital-one'
  | 'citi'
  | 'amex'
  | 'us-bank'
  | 'pnc'
  | 'td'
  | 'discover'

export type EngineStatus = 'native' | 'generic-fallback'

export type MarketingBank = {
  slug: MarketingBankSlug
  name: string
  family: 'bank' | 'credit-card'
  engineStatus: EngineStatus
}

export const MARKETING_BANKS: ReadonlyArray<MarketingBank> = [
  { slug: 'chase', name: 'Chase', family: 'credit-card', engineStatus: 'native' },
  {
    slug: 'bank-of-america',
    name: 'Bank of America',
    family: 'credit-card',
    engineStatus: 'native',
  },
  { slug: 'wells-fargo', name: 'Wells Fargo', family: 'bank', engineStatus: 'generic-fallback' },
  {
    slug: 'capital-one',
    name: 'Capital One',
    family: 'credit-card',
    engineStatus: 'generic-fallback',
  },
  { slug: 'citi', name: 'Citi', family: 'credit-card', engineStatus: 'generic-fallback' },
  {
    slug: 'amex',
    name: 'American Express',
    family: 'credit-card',
    engineStatus: 'generic-fallback',
  },
  { slug: 'us-bank', name: 'U.S. Bank', family: 'bank', engineStatus: 'generic-fallback' },
  { slug: 'pnc', name: 'PNC', family: 'bank', engineStatus: 'generic-fallback' },
  { slug: 'td', name: 'TD Bank', family: 'bank', engineStatus: 'generic-fallback' },
  {
    slug: 'discover',
    name: 'Discover',
    family: 'credit-card',
    engineStatus: 'generic-fallback',
  },
] as const

export function buildBankSlugs(): MarketingBankSlug[] {
  return MARKETING_BANKS.map((bank) => bank.slug)
}

export function getBankBySlug(slug: string): MarketingBank | undefined {
  return MARKETING_BANKS.find((bank) => bank.slug === slug)
}
