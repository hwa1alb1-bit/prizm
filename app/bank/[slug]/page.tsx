import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AppHeader } from '@/components/layout/app-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { JsonLd } from '@/components/marketing/json-ld'
import { UploadHero } from '@/components/marketing/upload-hero'
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildSoftwareApplicationJsonLd,
} from '@/lib/seo/site'
import { buildBankSlugs, getBankBySlug, type MarketingBank } from '@/lib/marketing/marketing-banks'
import {
  SUPPORTED_FORMATS,
  getIssuerBySlug,
  type SupportedFormat,
} from '@/lib/marketing/supported-issuers'

type BankSlugParams = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return buildBankSlugs().map((slug) => ({ slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: BankSlugParams): Promise<Metadata> {
  const { slug } = await params
  const bank = getBankBySlug(slug)
  if (!bank) {
    return buildPageMetadata({
      title: 'Bank statement converter | StatementStudio',
      description:
        'Convert PDF bank and credit card statements to Excel, CSV, QuickBooks, or Xero.',
      path: `/bank/${slug}`,
    })
  }
  return buildPageMetadata({
    title: `${bank.name} PDF to Excel, CSV, QuickBooks, Xero | StatementStudio`,
    description: `Convert ${bank.name} PDF bank and credit card statements to Excel, CSV, QuickBooks, or Xero. Automatic mathematical reconciliation to the cent with 24-hour auto-deletion.`,
    path: `/bank/${slug}`,
  })
}

function EngineStatusBadge({ bank }: { bank: MarketingBank }) {
  if (bank.engineStatus === 'native') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-success-soft)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--success)]">
        <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--success)]" />
        Native parser
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
      <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--text-muted)]" />
      Generic structural parser
    </span>
  )
}

function FormatGridCell({ format, bank }: { format: SupportedFormat; bank: MarketingBank }) {
  const issuerForConvert = getIssuerBySlug(bank.slug)
  if (issuerForConvert) {
    return (
      <Link
        href={`/convert/${issuerForConvert.slug}-${format.slug}`}
        className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <p className="text-sm font-semibold text-[var(--text-primary)]">{format.label}</p>
        <p className="text-xs leading-5 text-[var(--text-secondary)]">{format.description}</p>
        <span className="mt-auto text-xs font-semibold text-[var(--primary)]">
          {bank.name} → {format.label} →
        </span>
      </Link>
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{format.label}</p>
      <p className="text-xs leading-5 text-[var(--text-secondary)]">{format.description}</p>
    </div>
  )
}

export default async function BankSlugPage({ params }: BankSlugParams) {
  const { slug } = await params
  const bank = getBankBySlug(slug)
  if (!bank) {
    notFound()
  }

  const eyebrow = bank.family === 'credit-card' ? 'Credit card statement' : 'Bank statement'
  const headline = `${bank.name} statement to Excel, CSV, QuickBooks, or Xero`

  return (
    <>
      <JsonLd data={buildSoftwareApplicationJsonLd()} />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Banks', path: '/bank' },
          { name: bank.name, path: `/bank/${bank.slug}` },
        ])}
      />
      <AppHeader authed={false} />
      <main className="flex-1 bg-[var(--background)] text-[var(--text-primary)]">
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-14 lg:gap-12 lg:px-8 lg:py-18">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                {eyebrow}
              </p>
              <EngineStatusBadge bank={bank} />
            </div>
            <h1 className="mt-4 font-bold leading-[1.05] tracking-[-0.02em] text-[var(--text-primary)] text-[clamp(2rem,4.5vw,3.5rem)]">
              {headline}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
              Convert {bank.name} PDF statements into clean transaction files for QuickBooks, Xero,
              CSV, and Excel. Mathematical reconciliation to the cent with 24-hour auto-deletion.
            </p>
            {bank.engineStatus === 'generic-fallback' ? (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                {bank.name} runs through our generic structural parser, not a hand-tuned native
                adapter.{' '}
                <Link
                  href="/how-we-verify"
                  className="font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
                >
                  How we verify every export →
                </Link>
              </p>
            ) : null}
          </div>

          <Suspense fallback={null}>
            <UploadHero isAuthenticated={false} />
          </Suspense>
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--surface-soft)]">
          <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
            <h2 className="text-xl font-semibold">Export formats for {bank.name}</h2>
            <p className="mt-3 max-w-3xl text-sm text-[var(--text-secondary)]">
              Same parser, four output targets. Pick the one your downstream workflow needs.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SUPPORTED_FORMATS.map((format) => (
                <FormatGridCell key={format.slug} format={format} bank={bank} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
            <h2 className="text-xl font-semibold">More supported banks</h2>
            <p className="mt-3 max-w-3xl text-sm text-[var(--text-secondary)]">
              See the full list and pick another issuer.{' '}
              <Link
                href="/bank"
                className="font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
              >
                All supported banks →
              </Link>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
