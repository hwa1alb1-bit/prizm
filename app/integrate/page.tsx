import Link from 'next/link'
import { AppHeader } from '@/components/layout/app-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { JsonLd } from '@/components/marketing/json-ld'
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo/site'
import { MARKETING_INTEGRATIONS } from '@/lib/marketing/marketing-integrations'

export const metadata = buildPageMetadata({
  title: 'Bank statement to accounting software | StatementStudio',
  description:
    'Turn PDF bank statements into ready-to-import CSV files for QuickBooks Online and Xero. Reconciled to the cent with 24-hour auto-deletion.',
  path: '/integrate',
})

export default function IntegrateIndexPage() {
  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Integrate', path: '/integrate' },
        ])}
      />
      <AppHeader authed={false} />
      <main className="flex-1 bg-[var(--background)] text-[var(--text-primary)]">
        <section className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            Accounting integrations
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-4xl">
            Direct CSV imports into QuickBooks Online and Xero.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">
            Each integration page shows the exact import column mapping for that accounting tool,
            with a dropzone that runs the same reconciliation math used everywhere else on the site.
          </p>
        </section>

        <section className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
            <ul className="grid gap-4 sm:grid-cols-2">
              {MARKETING_INTEGRATIONS.map((integration) => (
                <li key={integration.slug}>
                  <Link
                    href={`/integrate/${integration.slug}`}
                    className="flex h-full flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <p className="text-base font-semibold text-[var(--text-primary)]">
                      {integration.name}
                    </p>
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">
                      {integration.format}
                    </p>
                    <span className="mt-auto text-sm font-semibold text-[var(--primary)]">
                      Convert PDF to {integration.name} CSV →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
