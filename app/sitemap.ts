import type { MetadataRoute } from 'next'
import { absoluteUrl, publicSitemapRoutes } from '@/lib/seo/site'
import { buildConvertSlugs } from '@/lib/marketing/supported-issuers'
import { buildBankSlugs } from '@/lib/marketing/marketing-banks'
import { buildIntegrationSlugs } from '@/lib/marketing/marketing-integrations'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-06-19T00:00:00.000Z')
  const staticEntries: MetadataRoute.Sitemap = publicSitemapRoutes.map((route) => ({
    url: absoluteUrl(route),
    lastModified,
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route.startsWith('/bank-statement') ? 0.9 : 0.6,
  }))
  const convertEntries: MetadataRoute.Sitemap = buildConvertSlugs().map((slug) => ({
    url: absoluteUrl(`/convert/${slug}`),
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))
  const bankEntries: MetadataRoute.Sitemap = buildBankSlugs().map((slug) => ({
    url: absoluteUrl(`/bank/${slug}`),
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))
  const integrateEntries: MetadataRoute.Sitemap = buildIntegrationSlugs().map((slug) => ({
    url: absoluteUrl(`/integrate/${slug}`),
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))
  return [...staticEntries, ...convertEntries, ...bankEntries, ...integrateEntries]
}
