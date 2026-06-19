import Link from 'next/link'
import { AppHeader } from '@/components/layout/app-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { JsonLd } from '@/components/marketing/json-ld'
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo/site'

export const metadata = buildPageMetadata({
  title: 'How we verify every export reconciles | StatementStudio',
  description:
    'Reconciliation math explained: opening balance plus credits and minus debits has to equal the printed closing balance, or we flag the export.',
  path: '/how-we-verify',
})

const SAMPLE = {
  bank: 'Sample Bank, N.A.',
  accountLast4: '4242',
  period: '2026-04-01 to 2026-04-30',
  openingBalance: 1_000.0,
  credits: [{ date: '2026-04-09', description: 'Payroll deposit', amount: 2_500.0 }],
  debits: [
    { date: '2026-04-03', description: 'Rent', amount: -1_650.0 },
    { date: '2026-04-12', description: 'Utilities', amount: -110.0 },
    { date: '2026-04-19', description: 'Grocery', amount: -240.0 },
    { date: '2026-04-25', description: 'Coffee shop', amount: -25.0 },
  ],
  closingBalance: 1_475.0,
}

export default function HowWeVerify() {
  const creditsTotal = SAMPLE.credits.reduce((sum, row) => sum + row.amount, 0)
  const debitsTotal = SAMPLE.debits.reduce((sum, row) => sum + row.amount, 0)
  const computedClosing = SAMPLE.openingBalance + creditsTotal + debitsTotal
  const reconciles = Math.abs(computedClosing - SAMPLE.closingBalance) < 0.005

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'How we verify', path: '/how-we-verify' },
        ])}
      />
      <AppHeader authed={false} />
      <main className="flex-1 bg-[var(--background)] text-[var(--text-primary)]">
        <section className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            Reconciled bank statement converter
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-4xl">
            Every export reconciles to the cent, or we tell you why it didn’t.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">
            StatementStudio runs the math on every statement before you download it. If the
            transactions don’t add up to the printed closing balance, the export carries a red flag
            and names the row that broke. No silent off-by-a-cent errors.
          </p>
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto max-w-4xl px-6 py-12 lg:px-8">
            <h2 className="text-xl font-semibold">The rule</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              For a bank statement to reconcile, this equation has to hold to the cent:
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-sm leading-7 text-[var(--text-primary)]">
              {`opening_balance
  + sum(credits)
  − sum(debits)
  = closing_balance`}
            </pre>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              Credit-card statements use the same idea with a family-specific equation. The numbers
              on the page have to equal what the transaction rows say.
            </p>
          </div>
        </section>

        <section className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-4xl px-6 py-12 lg:px-8">
            <h2 className="text-xl font-semibold">Worked example</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {SAMPLE.bank} · account ending {SAMPLE.accountLast4} · period {SAMPLE.period}
            </p>

            <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface)] text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">2026-04-01</td>
                    <td className="px-4 py-3 font-sans">Opening balance</td>
                    <td className="px-4 py-3 text-right">{currency(SAMPLE.openingBalance)}</td>
                  </tr>
                  {[...SAMPLE.credits, ...SAMPLE.debits]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((row) => (
                      <tr
                        key={`${row.date}-${row.description}`}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="px-4 py-3">{row.date}</td>
                        <td className="px-4 py-3 font-sans">{row.description}</td>
                        <td className="px-4 py-3 text-right">{currency(row.amount)}</td>
                      </tr>
                    ))}
                  <tr className="border-t-2 border-[var(--border)] bg-[var(--surface)]">
                    <td className="px-4 py-3">2026-04-30</td>
                    <td className="px-4 py-3 font-sans">Closing balance (reported)</td>
                    <td className="px-4 py-3 text-right">{currency(SAMPLE.closingBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  Computed
                </p>
                <p className="mt-2 font-mono text-base text-[var(--text-primary)]">
                  {currency(SAMPLE.openingBalance)} {creditsSign(creditsTotal)}{' '}
                  {currency(Math.abs(creditsTotal))} {debitsSign(debitsTotal)}{' '}
                  {currency(Math.abs(debitsTotal))} ={' '}
                  <span className="font-semibold">{currency(computedClosing)}</span>
                </p>
              </div>
              <div
                className="rounded-xl border p-5"
                style={{
                  borderColor: reconciles
                    ? 'var(--success, var(--primary))'
                    : 'var(--danger, #dc2626)',
                  background: reconciles
                    ? 'var(--success-soft, var(--surface))'
                    : 'var(--danger-soft, var(--surface))',
                }}
              >
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                  style={{
                    color: reconciles ? 'var(--success, var(--primary))' : 'var(--danger, #dc2626)',
                  }}
                >
                  Verdict: {reconciles ? 'Reconciled' : 'Mismatch'}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">
                  {reconciles
                    ? 'Computed equals reported. Export is marked Reconciled.'
                    : 'Computed differs from reported. Export is marked with a red flag and the failing row is named.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto max-w-4xl px-6 py-12 lg:px-8">
            <h2 className="text-xl font-semibold">When math fails, the export tells you</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
              <li>
                <span className="font-semibold text-[var(--text-primary)]">
                  reconciliation_mismatch
                </span>
                : the totals do not match. The export is not blocked, but the badge is red.
              </li>
              <li>
                <span className="font-semibold text-[var(--text-primary)]">
                  transactions_missing
                </span>
                : the parser found no rows. Almost always a layout we have not seen yet.
              </li>
            </ul>
            <p className="mt-6 text-sm text-[var(--text-secondary)]">
              Try a statement.{' '}
              <Link
                href="/"
                className="font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
              >
                Upload one on the homepage →
              </Link>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function creditsSign(value: number): string {
  return value >= 0 ? '+' : '−'
}

function debitsSign(value: number): string {
  return value < 0 ? '−' : '+'
}
