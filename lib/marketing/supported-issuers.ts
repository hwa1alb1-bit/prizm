/**
 * TypeScript mirror of the Kotlin extractor's IssuerDetector. Source of truth for the
 * marketing surface that lists supported issuers and generates per-issuer SEO routes at
 * `/convert/{issuerSlug}-{formatSlug}`.
 *
 * Keep in sync with `workers/kotlin-extractor/src/main/kotlin/com/prizm/extractor/IssuerDetector.kt`.
 * When a new issuer adapter lands on the Kotlin side, add the corresponding entry here in
 * the same PR.
 */

export type IssuerSlug = 'chase' | 'bank-of-america'

export type FormatSlug = 'excel' | 'csv' | 'quickbooks' | 'xero'

export type SupportedIssuer = {
  slug: IssuerSlug
  name: string
  family: 'credit-card' | 'bank'
  layoutKey: string
}

export type SupportedFormat = {
  slug: FormatSlug
  label: string
  description: string
}

export const SUPPORTED_ISSUERS: ReadonlyArray<SupportedIssuer> = [
  {
    slug: 'chase',
    name: 'Chase',
    family: 'credit-card',
    layoutKey: 'chase',
  },
  {
    slug: 'bank-of-america',
    name: 'Bank of America',
    family: 'credit-card',
    layoutKey: 'bank_of_america',
  },
] as const

export const SUPPORTED_FORMATS: ReadonlyArray<SupportedFormat> = [
  { slug: 'excel', label: 'Excel', description: 'XLSX file with one row per transaction.' },
  { slug: 'csv', label: 'CSV', description: 'Plain CSV ready for any spreadsheet tool.' },
  {
    slug: 'quickbooks',
    label: 'QuickBooks',
    description: 'CSV mapped to the QuickBooks transaction import format.',
  },
  {
    slug: 'xero',
    label: 'Xero',
    description: 'CSV mapped to the Xero bank statement import format.',
  },
] as const

export function getIssuerBySlug(slug: string): SupportedIssuer | undefined {
  return SUPPORTED_ISSUERS.find((entry) => entry.slug === slug)
}

export function getFormatBySlug(slug: string): SupportedFormat | undefined {
  return SUPPORTED_FORMATS.find((entry) => entry.slug === slug)
}

export function parseConvertSlug(slug: string): {
  issuer: SupportedIssuer
  format: SupportedFormat
} | null {
  for (const issuer of SUPPORTED_ISSUERS) {
    const prefix = `${issuer.slug}-`
    if (!slug.startsWith(prefix)) continue
    const formatSlug = slug.slice(prefix.length)
    const format = getFormatBySlug(formatSlug)
    if (format) return { issuer, format }
  }
  return null
}

export function buildConvertSlugs(): string[] {
  const slugs: string[] = []
  for (const issuer of SUPPORTED_ISSUERS) {
    for (const format of SUPPORTED_FORMATS) {
      slugs.push(`${issuer.slug}-${format.slug}`)
    }
  }
  return slugs
}
