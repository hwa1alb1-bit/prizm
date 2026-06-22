import type { MetadataRoute } from 'next'
import { absoluteUrl, publicSitemapRoutes } from '@/lib/seo/site'
import { buildConvertSlugs } from '@/lib/marketing/supported-issuers'

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
  return [...staticEntries, ...convertEntries]
}
