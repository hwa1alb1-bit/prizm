import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { AppHeader } from '@/components/layout/app-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { JsonLd } from '@/components/marketing/json-ld'
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo/site'
import { buildConvertSlugs, parseConvertSlug } from '@/lib/marketing/supported-issuers'
import { RelatedPagesRail } from '@/components/marketing/related-pages-rail'

type ConvertParams = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return buildConvertSlugs().map((slug) => ({ slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: ConvertParams): Promise<Metadata> {
  const { slug } = await params
  const parsed = parseConvertSlug(slug)
  if (!parsed) {
    return buildPageMetadata({
      title: 'Statement converter | StatementStudio',
      description: 'Convert PDF statements to Excel, CSV, QuickBooks, or Xero.',
      path: `/convert/${slug}`,
    })
  }
  const { issuer, format } = parsed
  return buildPageMetadata({
    title: `${issuer.name} statement to ${format.label} | StatementStudio`,
    description: `Convert ${issuer.name} PDF bank and credit card statements to ${format.label}. Deterministic reconciliation math, audit-friendly columns, 24-hour auto-deletion.`,
    path: `/convert/${slug}`,
  })
}

export default async function ConvertSlugPage({ params }: ConvertParams) {
  const { slug } = await params
  const parsed = parseConvertSlug(slug)
  if (!parsed) {
    notFound()
  }
  const { issuer, format } = parsed
  const headline = `${issuer.name} statement to ${format.label}.`

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Issuers', path: '/issuers' },
          { name: `${issuer.name} → ${format.label}`, path: `/convert/${slug}` },
        ])}
      />
      <AppHeader authed={false} />
      <main className="flex-1 bg-[var(--background)] text-[var(--text-primary)]">
        <section className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            {issuer.family === 'credit-card' ? 'Credit card statement' : 'Bank statement'}
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-4xl">
            {headline}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">
            {format.description} StatementStudio runs deterministic reconciliation math on every
            export, so the {format.label} you download matches what {issuer.name} actually printed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Convert a {issuer.name} statement
            </Link>
            <Link
              href="/how-we-verify"
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              How reconciliation works
            </Link>
          </div>
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto max-w-4xl px-6 py-12 lg:px-8">
            <h2 className="text-xl font-semibold">What you get</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
              <li>
                <span className="font-semibold text-[var(--text-primary)]">
                  {format.label} ready to import.
                </span>{' '}
                {format.description}
              </li>
              <li>
                <span className="font-semibold text-[var(--text-primary)]">
                  Reconciliation badge on every export.
                </span>{' '}
                Green when the math matches what {issuer.name} printed. Red flag and a named row
                when it does not.
              </li>
              <li>
                <span className="font-semibold text-[var(--text-primary)]">No OCR guesswork.</span>{' '}
                Selectable-text {issuer.name} statements parsed deterministically.
              </li>
              <li>
                <span className="font-semibold text-[var(--text-primary)]">24-hour retention.</span>{' '}
                Your PDF and the converted output auto-delete after a day. Audit event stays.
              </li>
            </ul>
          </div>
        </section>

        <section className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-4xl px-6 py-12 lg:px-8">
            <h2 className="text-xl font-semibold">Other formats for {issuer.name}</h2>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Same parser, different output target.{' '}
              <Link
                href="/issuers"
                className="font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
              >
                See the full issuer grid →
              </Link>
            </p>
          </div>
        </section>

        <RelatedPagesRail kind="convert" currentSlug={slug} />
      </main>
      <SiteFooter />
    </>
  )
}
