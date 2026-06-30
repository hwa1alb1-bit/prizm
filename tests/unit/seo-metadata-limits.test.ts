/**
 * Walks every page that emits SEO metadata and asserts title/description fall
 * within the limits in `lib/seo/limits.ts`. Failing this test means a new page
 * or programmatic-route variant exceeds Ahrefs/Google guidance and will
 * surface in the next site audit. Also asserts that every page sets its own
 * canonical via buildPageMetadata — bare `metadata = { title }` exports inherit
 * the root layout's `/` canonical, which Ahrefs flags as "Non-canonical page
 * in sitemap".
 */
import { describe, expect, it } from 'vitest'

import { TITLE_MAX, DESCRIPTION_MIN, DESCRIPTION_MAX } from '@/lib/seo/limits'
import { buildPageMetadata } from '@/lib/seo/site'
import { MARKETING_BANKS } from '@/lib/marketing/marketing-banks'
import { MARKETING_INTEGRATIONS } from '@/lib/marketing/marketing-integrations'
import { SUPPORTED_ISSUERS, SUPPORTED_FORMATS } from '@/lib/marketing/supported-issuers'
import { conversionPages } from '@/lib/seo/conversion-pages'

type Metadata = { title: string; description: string; path: string }

function expectWithinLimits(meta: Metadata) {
  expect(meta.title.length, `title too long for ${meta.path}: "${meta.title}"`).toBeLessThanOrEqual(
    TITLE_MAX,
  )
  expect(meta.title.length, `title empty for ${meta.path}`).toBeGreaterThan(0)
  expect(
    meta.description.length,
    `description too short for ${meta.path}: "${meta.description}"`,
  ).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
  expect(
    meta.description.length,
    `description too long for ${meta.path}: "${meta.description}"`,
  ).toBeLessThanOrEqual(DESCRIPTION_MAX)
}

describe('SEO metadata limits', () => {
  // Mirror the strings the per-page generateMetadata() returns. Keep these in
  // lockstep with the templates in app/bank/[slug]/page.tsx etc.
  describe('/bank/[slug]', () => {
    for (const bank of MARKETING_BANKS) {
      it(`${bank.name}`, () => {
        expectWithinLimits({
          title: `${bank.name} PDF statement converter | StatementStudio`,
          description: `Convert ${bank.name} PDF statements to Excel, CSV, QuickBooks, or Xero. Reconciled to the cent. 24-hour auto-deletion. Audit-friendly output.`,
          path: `/bank/${bank.slug}`,
        })
      })
    }
  })

  describe('/integrate/[slug]', () => {
    for (const integration of MARKETING_INTEGRATIONS) {
      it(`${integration.name}`, () => {
        expectWithinLimits({
          title: `PDF statement to ${integration.name} CSV | StatementStudio`,
          description: `Turn PDF bank and credit card statements into ${integration.name}-ready CSV imports. Reconciled to the cent. 24-hour auto-deletion. Built for bookkeepers.`,
          path: `/integrate/${integration.slug}`,
        })
      })
    }
  })

  describe('/convert/[slug]', () => {
    for (const issuer of SUPPORTED_ISSUERS) {
      for (const format of SUPPORTED_FORMATS) {
        it(`${issuer.name} → ${format.label}`, () => {
          expectWithinLimits({
            title: `${issuer.name} statement to ${format.label} | StatementStudio`,
            description: `Convert ${issuer.name} PDF bank and credit card statements to ${format.label}. Deterministic reconciliation math, audit-friendly columns, 24-hour auto-deletion.`,
            path: `/convert/${issuer.slug}-${format.slug}`,
          })
        })
      }
    }
  })

  describe('/[seo-route] conversion pages', () => {
    for (const page of Object.values(conversionPages)) {
      it(`${page.path}`, () => {
        expectWithinLimits({ title: page.title, description: page.description, path: page.path })
      })
    }
  })

  describe('static marketing & trust pages', () => {
    const staticPages: Metadata[] = [
      {
        title: 'PDF Bank Statement Converter | StatementStudio',
        description:
          'Convert PDF bank and credit card statements into QuickBooks, Xero, Excel, and CSV. Reconciled to the cent. 24-hour auto-deletion.',
        path: '/',
      },
      {
        title: 'Supported banks for PDF conversion | StatementStudio',
        description:
          'Convert PDF statements from Chase, Bank of America, Wells Fargo, Capital One, Citi, Amex, U.S. Bank, PNC, TD, and Discover into Excel, CSV, QuickBooks, or Xero.',
        path: '/bank',
      },
      {
        title: 'Bank statement to accounting software | StatementStudio',
        description:
          'Turn PDF bank statements into ready-to-import CSV files for QuickBooks Online and Xero. Reconciled to the cent with 24-hour auto-deletion.',
        path: '/integrate',
      },
      {
        title: 'Supported issuers and output formats | StatementStudio',
        description:
          'Every supported bank and credit card issuer, paired with every supported output format. Each cell links to a dedicated conversion page.',
        path: '/issuers',
      },
      {
        title: 'Sample input and output | StatementStudio',
        description:
          'A worked example: a Sample Bank statement PDF in, a clean CSV out. Same rows, same columns, no missing transactions.',
        path: '/sample-output',
      },
      {
        title: 'Throughput, measured | StatementStudio',
        description:
          'Latest extraction benchmark: P95 conversion acceptance and time to ready across 100, 250, and 500 concurrent statements. Numbers updated on every release.',
        path: '/throughput',
      },
      {
        title: 'How we verify every export reconciles | StatementStudio',
        description:
          'Reconciliation math explained: opening balance plus credits and minus debits has to equal the printed closing balance, or we flag the export.',
        path: '/how-we-verify',
      },
      {
        title: 'Billing FAQ and account help | StatementStudio',
        description:
          'StatementStudio billing FAQ and account help: what counts as a page, monthly vs daily quotas, cancellations, refunds, and how to reach support.',
        path: '/help',
      },
      {
        title: 'Security controls and disclosure | StatementStudio',
        description:
          'StatementStudio security controls, vulnerability disclosure contacts, encryption posture, retention windows, and planned controls on the path to production.',
        path: '/security',
      },
      {
        title: 'Security policy and disclosure | StatementStudio',
        description:
          'StatementStudio vulnerability disclosure policy, safe harbor commitments, security reporting contacts, and response timelines for researchers and customers.',
        path: '/security/policy',
      },
      {
        title: 'Subprocessors and vendor inventory | StatementStudio',
        description:
          'Every third-party vendor StatementStudio uses, the purpose of each, and a link to their data processing agreement (DPA) for compliance review.',
        path: '/security/subprocessors',
      },
      {
        title: 'Privacy commitments and data rights | StatementStudio',
        description:
          'StatementStudio privacy: 24-hour document retention, no model training, encryption in transit and at rest, and how to exercise data-rights requests.',
        path: '/privacy',
      },
      {
        title: 'Alpha service terms | StatementStudio',
        description:
          'StatementStudio alpha service terms: acceptable use, billing semantics, operational limits, and customer obligations on the path to production launch.',
        path: '/terms',
      },
      {
        title: 'Launch readiness and operational status | StatementStudio',
        description:
          'StatementStudio launch readiness: operational status, incident posture, change-management practice, and remaining items on the path to general availability.',
        path: '/status',
      },
      {
        title: 'API error response format | StatementStudio',
        description:
          'StatementStudio API error format: RFC 7807 problem detail JSON, HTTP status mapping, machine-readable type URIs, and every error code the API can return.',
        path: '/docs/errors',
      },
      {
        title: 'API rate-limit semantics | StatementStudio',
        description:
          'StatementStudio API rate-limit semantics: per-workspace caps, burst windows, Retry-After conventions, X-RateLimit headers, and recommended client backoff.',
        path: '/docs/rate-limits',
      },
    ]

    for (const page of staticPages) {
      it(`${page.path}`, () => expectWithinLimits(page))
    }

    // Regression guard: trust + docs pages previously bypassed buildPageMetadata
    // and inherited the root layout's canonical='/', producing Ahrefs's
    // "Non-canonical page in sitemap" flag on 8 routes. Confirm every page's
    // helper-generated canonical points at its own path, not /.
    describe('canonical points at the page itself, not the root', () => {
      for (const page of staticPages) {
        if (page.path === '/') continue
        it(`${page.path}`, () => {
          const meta = buildPageMetadata(page) as { alternates?: { canonical?: string } }
          expect(meta.alternates?.canonical).toBe(page.path)
          expect(meta.alternates?.canonical).not.toBe('/')
        })
      }
    })
  })
})
