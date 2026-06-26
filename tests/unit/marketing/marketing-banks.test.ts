import { describe, expect, it } from 'vitest'
import { MARKETING_BANKS, buildBankSlugs, getBankBySlug } from '@/lib/marketing/marketing-banks'

describe('MARKETING_BANKS', () => {
  it('exposes ten marketing banks for programmatic SEO', () => {
    expect(MARKETING_BANKS.length).toBe(10)
  })

  it('marks Chase and Bank of America as native (mirrors Kotlin IssuerDetector)', () => {
    const chase = MARKETING_BANKS.find((bank) => bank.slug === 'chase')
    const boa = MARKETING_BANKS.find((bank) => bank.slug === 'bank-of-america')
    expect(chase?.engineStatus).toBe('native')
    expect(boa?.engineStatus).toBe('native')
  })

  it('marks the other eight banks as generic-fallback so the page can disclose engine status honestly', () => {
    const fallback = MARKETING_BANKS.filter((bank) => bank.engineStatus === 'generic-fallback')
    expect(fallback.length).toBe(8)
  })

  it('covers the long-tail US consumer bank universe', () => {
    const slugs = MARKETING_BANKS.map((bank) => bank.slug)
    for (const expected of [
      'chase',
      'bank-of-america',
      'wells-fargo',
      'capital-one',
      'citi',
      'amex',
      'us-bank',
      'pnc',
      'td',
      'discover',
    ]) {
      expect(slugs).toContain(expected)
    }
  })

  it('uses kebab-case URL-safe slugs only', () => {
    for (const bank of MARKETING_BANKS) {
      expect(bank.slug).toMatch(/^[a-z]+(-[a-z]+)*$/)
    }
  })
})

describe('buildBankSlugs', () => {
  it('returns all ten bank slugs for generateStaticParams', () => {
    expect(buildBankSlugs()).toHaveLength(10)
  })
})

describe('getBankBySlug', () => {
  it('round-trips known slugs', () => {
    expect(getBankBySlug('chase')?.name).toBe('Chase')
    expect(getBankBySlug('wells-fargo')?.name).toBe('Wells Fargo')
  })

  it('returns undefined for unknown slugs', () => {
    expect(getBankBySlug('unknown-bank')).toBeUndefined()
  })
})
