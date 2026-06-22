import Link from 'next/link'
import { AppHeader } from '@/components/layout/app-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { JsonLd } from '@/components/marketing/json-ld'
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo/site'
import { SUPPORTED_FORMATS, SUPPORTED_ISSUERS } from '@/lib/marketing/supported-issuers'

export const metadata = buildPageMetadata({
  title: 'Supported issuers and output formats | StatementStudio',
  description:
    'Every supported bank and credit card issuer, paired with every supported output format. Each cell links to a dedicated conversion page.',
  path: '/issuers',
})

export default function IssuersPage() {
  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Issuers', path: '/issuers' },
        ])}
      />
      <AppHeader authed={false} />
      <main className="flex-1 bg-[var(--background)] text-[var(--text-primary)]">
        <section className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            What we convert today
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-4xl">
            Supported issuers and output formats.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">
            New issuers land as adapters behind the same parser. When a layout joins the engine, a
            row joins this grid in the same release.
          </p>
        </section>

        <section className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface)] text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Issuer</th>
                    {SUPPORTED_FORMATS.map((format) => (
                      <th key={format.slug} className="px-4 py-3 font-semibold">
                        {format.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SUPPORTED_ISSUERS.map((issuer) => (
                    <tr key={issuer.slug} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                        {issuer.name}
                        <span className="ml-2 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                          {issuer.family}
                        </span>
                      </td>
                      {SUPPORTED_FORMATS.map((format) => (
                        <td key={format.slug} className="px-4 py-3">
                          <Link
                            href={`/convert/${issuer.slug}-${format.slug}`}
                            className="font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
                          >
                            {issuer.name} → {format.label}
                          </Link>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-6 text-sm text-[var(--text-secondary)]">
              Missing your bank? Upload a statement anyway. If we can read the text, the engine will
              tell you what it can extract and what needs a new adapter.{' '}
              <Link
                href="/"
                className="font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
              >
                Try a statement →
              </Link>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
