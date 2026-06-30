import type { Metadata } from 'next'

export type PageMetadataInput = {
  title: string
  description: string
  path: string
}

export type BreadcrumbItem = {
  name: string
  path: string
}

export type FaqItem = {
  question: string
  answer: string
}

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pdftoexcelstatementconverter.com'

export const siteUrl = rawSiteUrl.replace(/\/$/, '')
export const siteName = 'StatementStudio'

export const seoRoutes = [
  '/bank-statement-converter',
  '/bank-statement-to-excel',
  '/bank-statement-to-csv',
  '/convert-scanned-bank-statements',
  '/faq/bank-statement-conversion',
] as const

export const trustRoutes = [
  '/security',
  '/security/policy',
  '/security/subprocessors',
  '/privacy',
  '/terms',
  '/status',
  '/docs/errors',
  '/docs/rate-limits',
] as const

export const marketingProofRoutes = [
  '/how-we-verify',
  '/throughput',
  '/sample-output',
  '/issuers',
  '/bank',
  '/integrate',
] as const

export const publicSitemapRoutes = [
  '/',
  ...seoRoutes,
  ...trustRoutes,
  ...marketingProofRoutes,
] as const

export function absoluteUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${siteUrl}${normalizedPath}`
}

// Default OG / Twitter image surfaced on every page that opts into buildPageMetadata.
// Mirrors the default in app/layout.tsx; Next.js does NOT merge per-page openGraph
// with the root layout — it replaces. So if a page sets openGraph without images,
// the inheritance breaks. Keeping this in the helper means every marketing page
// gets a card image for free.
export const defaultSocialImage = {
  url: '/marketing/logos/statementstudio-mark.png',
  width: 512,
  height: 512,
  alt: 'StatementStudio',
} as const

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const url = absoluteUrl(input.path)

  return {
    title: {
      absolute: input.title,
    },
    description: input.description,
    alternates: {
      canonical: input.path,
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName,
      type: 'website',
      locale: 'en_US',
      images: [defaultSocialImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: [defaultSocialImage.url],
    },
  }
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: siteUrl,
    email: 'support@pdftoexcelstatementconverter.com',
    sameAs: [absoluteUrl('/security'), absoluteUrl('/privacy')],
  }
}

export function buildSoftwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteName,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All',
    url: siteUrl,
    description:
      'StatementStudio converts PDF bank statements into reviewable Excel and CSV-ready transaction data.',
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'USD',
    },
    featureList: [
      'PDF bank statement upload',
      'Transaction review before export',
      'Excel and CSV export',
      '24-hour document retention window',
    ],
  }
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function buildFaqJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}
