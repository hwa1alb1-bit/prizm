import { describe, expect, it } from 'vitest'
import sitemap from '@/app/sitemap'
import { MARKETING_BANKS } from '@/lib/marketing/marketing-banks'

describe('sitemap', () => {
  it('includes a /bank/[slug] entry for every marketing bank', () => {
    const urls = sitemap().map((entry) => entry.url)
    for (const bank of MARKETING_BANKS) {
      expect(urls.some((url) => url.endsWith(`/bank/${bank.slug}`))).toBe(true)
    }
  })

  it('includes the /bank index route for the bank family', () => {
    const urls = sitemap().map((entry) => entry.url)
    expect(urls.some((url) => url.endsWith('/bank'))).toBe(true)
  })

  it('preserves the existing /convert/[slug] entries (no regression on Wave 3)', () => {
    const urls = sitemap().map((entry) => entry.url)
    expect(urls.some((url) => url.endsWith('/convert/chase-excel'))).toBe(true)
  })
})
