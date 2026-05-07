import Link from 'next/link'

const proofPoints = [
  {
    label: 'Secure',
    copy: 'Files stay inside the verified upload path and expire after 24 hours.',
  },
  {
    label: 'Accurate',
    copy: 'Every conversion lands in review before the spreadsheet is exported.',
  },
  {
    label: 'Audited',
    copy: 'Security, privacy, deletion, and status evidence stay visible from launch.',
  },
]

const conversionRows = [
  ['05/01/2026', 'Client deposit', '', '2,450.00', '8,902.14'],
  ['05/03/2026', 'Card payment', '186.33', '', '8,715.81'],
  ['05/06/2026', 'Bank fee', '12.00', '', '8,703.81'],
]

const launchTiers = [
  {
    name: 'Try',
    note: 'Free account to start',
    detail: 'Start with the lean PDF workflow and review each result before export.',
  },
  {
    name: 'Convert',
    note: 'Credits for more statements',
    detail: 'Each PDF is quoted before upload so firms know the conversion cost upfront.',
  },
  {
    name: 'Trust',
    note: 'Security and status surfaced',
    detail: 'Review the security model, subprocessors, privacy workflow, and launch status.',
  },
]

export default function Home() {
  return (
    <main className="flex-1 bg-background text-foreground">
      <section className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[minmax(0,0.96fr)_minmax(24rem,1fr)] lg:items-center lg:px-8 lg:py-20">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/50">
            PRIZM bank statement converter
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-foreground sm:text-5xl">
            Convert PDF bank statements to clean Excel and CSV.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-foreground/65 sm:text-lg">
            Upload a bank statement PDF, review the extracted rows, then export a spreadsheet your
            accounting workflow can use. PRIZM keeps the path lean and shows the evidence behind
            each conversion.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Start converting
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[var(--border-subtle)] px-5 text-sm font-medium transition hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Sign in
            </Link>
            <Link
              href="/security"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[var(--border-subtle)] px-5 text-sm font-medium transition hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Security
            </Link>
          </div>

          <dl className="mt-10 grid gap-4 sm:grid-cols-3">
            {proofPoints.map((point) => (
              <div key={point.label} className="border-t border-[var(--border-subtle)] pt-4">
                <dt className="text-sm font-semibold">{point.label}</dt>
                <dd className="mt-2 text-sm leading-6 text-foreground/65">{point.copy}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside
          className="min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 shadow-sm"
          aria-label="Converted statement preview"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/45">
                Conversion preview
              </p>
              <h2 className="mt-2 text-lg font-semibold">May Statement.pdf</h2>
            </div>
            <span className="rounded-md bg-[color-mix(in_oklch,var(--success)_16%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
              Reviewed
            </span>
          </div>

          <div className="mt-5 overflow-x-auto rounded-md border border-[var(--border-subtle)] bg-background">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-[var(--border-subtle)] text-xs uppercase tracking-[0.08em] text-foreground/45">
                <tr>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Description</th>
                  <th className="px-3 py-2 text-right font-semibold">Debit</th>
                  <th className="px-3 py-2 text-right font-semibold">Credit</th>
                  <th className="px-3 py-2 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {conversionRows.map((row) => (
                  <tr key={`${row[0]}:${row[1]}`}>
                    {row.map((cell, index) => (
                      <td
                        key={`${row[0]}:${row[1]}:${index}`}
                        className={`px-3 py-3 ${index >= 2 ? 'text-right' : ''}`}
                      >
                        {cell || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-md border border-[var(--border-subtle)] bg-background p-3">
              <p className="text-foreground/50">Format</p>
              <p className="mt-1 font-semibold">XLSX or CSV</p>
            </div>
            <div className="rounded-md border border-[var(--border-subtle)] bg-background p-3">
              <p className="text-foreground/50">Cost</p>
              <p className="mt-1 font-semibold">1 credit</p>
            </div>
            <div className="rounded-md border border-[var(--border-subtle)] bg-background p-3">
              <p className="text-foreground/50">Deletes</p>
              <p className="mt-1 font-semibold">24 hours</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-12 lg:grid-cols-3 lg:px-8">
          {launchTiers.map((tier) => (
            <article
              key={tier.name}
              className="rounded-lg border border-[var(--border-subtle)] bg-background p-5"
            >
              <h2 className="text-lg font-semibold">{tier.name}</h2>
              <p className="mt-2 text-sm font-medium text-[var(--accent)]">{tier.note}</p>
              <p className="mt-3 text-sm leading-6 text-foreground/65">{tier.detail}</p>
              {tier.name === 'Trust' ? (
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <Link className="font-medium text-[var(--accent)]" href="/status">
                    Status
                  </Link>
                  <Link className="font-medium text-[var(--accent)]" href="/privacy">
                    Privacy
                  </Link>
                  <Link className="font-medium text-[var(--accent)]" href="/terms">
                    Terms
                  </Link>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
