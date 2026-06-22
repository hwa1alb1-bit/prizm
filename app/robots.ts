import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app/', '/ops/', '/api/', '/auth/callback', '/auth/finish'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
