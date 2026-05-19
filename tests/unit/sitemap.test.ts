import { describe, expect, it } from 'vitest'
import sitemap from '@/app/sitemap'
import { absoluteUrl } from '@/lib/seo/site'

describe('sitemap', () => {
  it('includes public SEO and trust routes while excluding private surfaces', () => {
    const urls = sitemap().map((entry) => entry.url)

    expect(urls).toEqual(
      expect.arrayContaining([
        absoluteUrl('/'),
        absoluteUrl('/bank-statement-converter'),
        absoluteUrl('/bank-statement-to-excel'),
        absoluteUrl('/bank-statement-to-csv'),
        absoluteUrl('/convert-scanned-bank-statements'),
        absoluteUrl('/faq/bank-statement-conversion'),
        absoluteUrl('/security'),
        absoluteUrl('/privacy'),
      ]),
    )
    expect(urls.some((url) => url.includes('/app'))).toBe(false)
    expect(urls.some((url) => url.includes('/ops'))).toBe(false)
    expect(urls.some((url) => url.includes('/api'))).toBe(false)
  })
})
