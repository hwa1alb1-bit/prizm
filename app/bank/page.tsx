import Link from 'next/link'
import { AppHeader } from '@/components/layout/app-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { JsonLd } from '@/components/marketing/json-ld'
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo/site'
import { MARKETING_BANKS } from '@/lib/marketing/marketing-banks'

export const metadata = buildPageMetadata({
  title: 'Supported banks for PDF conversion | StatementStudio',
  description:
    'Convert PDF statements from Chase, Bank of America, Wells Fargo, Capital One, Citi, Amex, U.S. Bank, PNC, TD, and Discover into Excel, CSV, QuickBooks, or Xero.',
  path: '/bank',
})

export default function BankIndexPage() {
  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Banks', path: '/bank' },
        ])}
      />
      <AppHeader authed={false} />
      <main className="flex-1 bg-[var(--background)] text-[var(--text-primary)]">
        <section className="mx-auto max-w-6xl px-6 py-16 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            Programmatic landing pages
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-4xl">
            Convert PDF statements from any major US bank.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">
            Each bank has a dedicated landing page with its own export grid. Chase and Bank of
            America run through hand-tuned native parsers; the rest use our generic structural
            parser with the same reconciliation math and the same 24-hour auto-deletion.
          </p>
        </section>

        <section className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8">
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MARKETING_BANKS.map((bank) => (
                <li key={bank.slug}>
                  <Link
                    href={`/bank/${bank.slug}`}
                    className="flex h-full flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold text-[var(--text-primary)]">
                        {bank.name}
                      </p>
                      <span
                        className={
                          bank.engineStatus === 'native'
                            ? 'rounded-full bg-[var(--surface-success-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--success)]'
                            : 'rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]'
                        }
                      >
                        {bank.engineStatus === 'native' ? 'Native' : 'Generic'}
                      </span>
                    </div>
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                      {bank.family === 'credit-card' ? 'Credit card' : 'Bank'}
                    </p>
                    <span className="mt-auto text-sm font-semibold text-[var(--primary)]">
                      {bank.name} PDF to Excel, CSV, QuickBooks, or Xero →
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
