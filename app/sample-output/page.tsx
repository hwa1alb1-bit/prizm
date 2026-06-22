import Link from 'next/link'
import { AppHeader } from '@/components/layout/app-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { JsonLd } from '@/components/marketing/json-ld'
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo/site'

export const metadata = buildPageMetadata({
  title: 'Sample input and output | StatementStudio',
  description:
    'A worked example: a Sample Bank statement PDF in, a clean CSV out. Same rows, same columns, no missing transactions.',
  path: '/sample-output',
})

const PDF_LINES = [
  'Sample Bank, N.A.',
  'Account 1111 2222 3333 4242',
  'Statement period 04/01/2026 to 04/30/2026',
  'Opening balance: $1,000.00',
  '',
  '04/03  Rent                  -$1,650.00',
  '04/09  Payroll deposit       +$2,500.00',
  '04/12  Utilities                -$110.00',
  '04/19  Grocery                  -$240.00',
  '04/25  Coffee shop               -$25.00',
  '',
  'Closing balance: $1,475.00',
]

const CSV_ROWS = [
  ['date', 'description', 'debit', 'credit', 'balance'],
  ['2026-04-01', 'Opening balance', '', '', '1000.00'],
  ['2026-04-03', 'Rent', '1650.00', '', '-650.00'],
  ['2026-04-09', 'Payroll deposit', '', '2500.00', '1850.00'],
  ['2026-04-12', 'Utilities', '110.00', '', '1740.00'],
  ['2026-04-19', 'Grocery', '240.00', '', '1500.00'],
  ['2026-04-25', 'Coffee shop', '25.00', '', '1475.00'],
  ['2026-04-30', 'Closing balance', '', '', '1475.00'],
]

export default function SampleOutputPage() {
  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Sample output', path: '/sample-output' },
        ])}
      />
      <AppHeader authed={false} />
      <main className="flex-1 bg-[var(--background)] text-[var(--text-primary)]">
        <section className="mx-auto max-w-6xl px-6 py-16 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            See it for yourself
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-4xl">
            A real statement in, a clean CSV out.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">
            Manufactured data. Same parser as your real statements. Every row carries date,
            description, debit, credit, and running balance. Reconciliation badge confirms the math.
          </p>
        </section>

        <section className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <header className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Input PDF</h2>
                  <span className="rounded-full bg-[var(--background)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                    sample-bank.pdf
                  </span>
                </header>
                <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-xs leading-6 text-[var(--text-primary)]">
                  {PDF_LINES.join('\n')}
                </pre>
              </article>

              <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <header className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Output CSV</h2>
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{
                      background: 'var(--success-soft, var(--background))',
                      color: 'var(--success, var(--primary))',
                    }}
                  >
                    Reconciled
                  </span>
                </header>
                <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--background)] text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                      <tr>
                        {CSV_ROWS[0].map((header) => (
                          <th key={header} className="px-3 py-2 font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {CSV_ROWS.slice(1).map((row, index) => (
                        <tr key={index} className="border-t border-[var(--border)]">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-3 py-2 text-[var(--text-primary)]">
                              {cell || <span className="text-[var(--text-secondary)]">·</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>

            <p className="mt-8 text-sm text-[var(--text-secondary)]">
              Try this on a statement you actually need converted.{' '}
              <Link
                href="/"
                className="font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
              >
                Drop your file on the homepage →
              </Link>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
