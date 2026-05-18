import { describe, expect, it } from 'vitest'
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildOrganizationJsonLd,
  buildPageMetadata,
  buildSoftwareApplicationJsonLd,
  publicSitemapRoutes,
} from '@/lib/seo/site'

describe('SEO metadata helpers', () => {
  it('builds canonical, Open Graph, and Twitter metadata for a public route', () => {
    const metadata = buildPageMetadata({
      title: 'Bank Statement Converter to Excel | PrizmView',
      description:
        'Convert PDF bank statements into clean Excel or CSV files with secure processing and review.',
      path: '/bank-statement-converter',
    })

    expect(metadata.alternates?.canonical).toBe('/bank-statement-converter')
    expect(metadata.openGraph?.title).toBe('Bank Statement Converter to Excel | PrizmView')
    expect(metadata.openGraph?.url).toBe('https://prizmview.app/bank-statement-converter')
    expect(metadata.openGraph?.siteName).toBe('PrizmView')
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' })
  })

  it('builds product schema without unsupported public claims', () => {
    const schema = buildSoftwareApplicationJsonLd()
    const serialized = JSON.stringify(schema)

    expect(schema['@type']).toBe('SoftwareApplication')
    expect(schema.name).toBe('PrizmView')
    expect(serialized).not.toMatch(/SOC 2 compliant|100% accuracy|bank-level encryption/i)
  })

  it('builds organization, breadcrumb, and FAQ schema for public pages', () => {
    expect(buildOrganizationJsonLd()).toMatchObject({
      '@type': 'Organization',
      name: 'PrizmView',
      url: 'https://prizmview.app',
    })

    expect(
      buildBreadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'FAQ', path: '/faq/bank-statement-conversion' },
      ]),
    ).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://prizmview.app/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'FAQ',
          item: 'https://prizmview.app/faq/bank-statement-conversion',
        },
      ],
    })

    expect(
      buildFaqJsonLd([
        {
          question: 'Can I convert a PDF bank statement to CSV?',
          answer: 'Yes. Review extracted rows before exporting a CSV file.',
        },
      ]),
    ).toMatchObject({
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Can I convert a PDF bank statement to CSV?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Review extracted rows before exporting a CSV file.',
          },
        },
      ],
    })
  })

  it('tracks the public SEO routes for sitemap and links', () => {
    expect(publicSitemapRoutes).toEqual(
      expect.arrayContaining([
        '/',
        '/bank-statement-converter',
        '/bank-statement-to-excel',
        '/bank-statement-to-csv',
        '/convert-scanned-bank-statements',
        '/faq/bank-statement-conversion',
        '/security',
        '/privacy',
      ]),
    )
    expect(publicSitemapRoutes).not.toContain('/app')
    expect(publicSitemapRoutes).not.toContain('/ops')
    expect(publicSitemapRoutes).not.toContain('/api')
  })
})
