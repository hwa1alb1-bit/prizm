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
import { buildIntegrationSlugs, getIntegrationBySlug } from '@/lib/marketing/marketing-integrations'
import { RelatedPagesRail } from '@/components/marketing/related-pages-rail'

type IntegrateParams = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return buildIntegrationSlugs().map((slug) => ({ slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: IntegrateParams): Promise<Metadata> {
  const { slug } = await params
  const integration = getIntegrationBySlug(slug)
  if (!integration) {
    return buildPageMetadata({
      title: 'Bank statement to accounting CSV | StatementStudio',
      description: 'Convert PDF bank statements into accounting-software CSV imports.',
      path: `/integrate/${slug}`,
    })
  }
  return buildPageMetadata({
    title: `PDF statement to ${integration.name} CSV | StatementStudio`,
    description: `Turn PDF bank and credit card statements into ${integration.name}-ready CSV imports. Reconciled to the cent. 24-hour auto-deletion. Built for bookkeepers.`,
    path: `/integrate/${slug}`,
  })
}

export default async function IntegrateSlugPage({ params }: IntegrateParams) {
  const { slug } = await params
  const integration = getIntegrationBySlug(slug)
  if (!integration) {
    notFound()
  }
  const headline = `PDF bank statement to ${integration.name} import`

  return (
    <>
      <JsonLd data={buildSoftwareApplicationJsonLd()} />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Integrate', path: '/integrate' },
          { name: integration.name, path: `/integrate/${integration.slug}` },
        ])}
      />
      <AppHeader authed={false} />
      <main className="flex-1 bg-[var(--background)] text-[var(--text-primary)]">
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-14 lg:gap-12 lg:px-8 lg:py-18">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              Accounting workflow
            </p>
            <h1 className="mt-2 font-bold leading-[1.05] tracking-[-0.02em] text-[var(--text-primary)] text-[clamp(2rem,4.5vw,3.5rem)]">
              {headline}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
              Convert bank, credit card, and financial PDF statements into a{' '}
              {integration.format.toLowerCase()} ready to import into {integration.name}. Each row
              is reconciled to the printed close before export.
            </p>
          </div>

          <Suspense fallback={null}>
            <UploadHero isAuthenticated={false} />
          </Suspense>
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--surface-soft)]">
          <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
            <h2 className="text-xl font-semibold">{integration.name} import column mapping</h2>
            <p className="mt-3 max-w-3xl text-sm text-[var(--text-secondary)]">
              How each PDF transaction row maps into the CSV {integration.name} expects.
            </p>
            <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table
                aria-label={`${integration.name} import column mapping`}
                className="w-full text-left text-sm"
              >
                <thead className="bg-[var(--surface)] text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      {integration.name} column
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Source in the PDF
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {integration.importColumns.map((column) => (
                    <tr key={column.name} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                        {column.name}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{column.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-sm text-[var(--text-secondary)]">
              Want to see how reconciliation guards against drift?{' '}
              <Link
                href="/how-we-verify"
                className="font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
              >
                How we verify every export →
              </Link>
            </p>
          </div>
        </section>

        <RelatedPagesRail kind="integration" currentSlug={integration.slug} />
      </main>
      <SiteFooter />
    </>
  )
}
