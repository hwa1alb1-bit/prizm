import type { MetadataRoute } from 'next'
import { absoluteUrl, publicSitemapRoutes } from '@/lib/seo/site'

export default function sitemap(): MetadataRoute.Sitemap {
  return publicSitemapRoutes.map((route) => ({
    url: absoluteUrl(route),
    lastModified: new Date('2026-05-18T00:00:00.000Z'),
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route.startsWith('/bank-statement') ? 0.9 : 0.6,
  }))
}
