import { describe, expect, it } from 'vitest'
import sitemap from '@/app/sitemap'
import { MARKETING_INTEGRATIONS } from '@/lib/marketing/marketing-integrations'

describe('sitemap /integrate entries', () => {
  it('includes an /integrate/[slug] entry for every marketing integration', () => {
    const urls = sitemap().map((entry) => entry.url)
    for (const integration of MARKETING_INTEGRATIONS) {
      expect(urls.some((url) => url.endsWith(`/integrate/${integration.slug}`))).toBe(true)
    }
  })

  it('includes the /integrate index route', () => {
    const urls = sitemap().map((entry) => entry.url)
    expect(urls.some((url) => url.endsWith('/integrate'))).toBe(true)
  })
})
