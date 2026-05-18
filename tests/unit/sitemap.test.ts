import { describe, expect, it } from 'vitest'
import sitemap from '@/app/sitemap'

describe('sitemap', () => {
  it('includes public SEO and trust routes while excluding private surfaces', () => {
    const urls = sitemap().map((entry) => entry.url)

    expect(urls).toEqual(
      expect.arrayContaining([
        'https://prizmview.app/',
        'https://prizmview.app/bank-statement-converter',
        'https://prizmview.app/bank-statement-to-excel',
        'https://prizmview.app/bank-statement-to-csv',
        'https://prizmview.app/convert-scanned-bank-statements',
        'https://prizmview.app/faq/bank-statement-conversion',
        'https://prizmview.app/security',
        'https://prizmview.app/privacy',
      ]),
    )
    expect(urls.some((url) => url.includes('/app'))).toBe(false)
    expect(urls.some((url) => url.includes('/ops'))).toBe(false)
    expect(urls.some((url) => url.includes('/api'))).toBe(false)
  })
})
