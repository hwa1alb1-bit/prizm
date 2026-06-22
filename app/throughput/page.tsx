import { AppHeader } from '@/components/layout/app-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { JsonLd } from '@/components/marketing/json-ld'
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo/site'
import { loadLatestBenchmark } from '@/lib/marketing/throughput'

export const metadata = buildPageMetadata({
  title: 'Throughput, measured | StatementStudio',
  description:
    'Latest extraction benchmark: P95 conversion acceptance and time to ready across 100, 250, and 500 concurrent statements. Numbers updated on every release.',
  path: '/throughput',
})

export default function ThroughputPage() {
  const benchmark = loadLatestBenchmark()

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Throughput', path: '/throughput' },
        ])}
      />
      <AppHeader authed={false} />
      <main className="flex-1 bg-[var(--background)] text-[var(--text-primary)]">
        <section className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            Speed you can count on
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-4xl">
            Fast, even when everyone shows up at once.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">
            We measure how StatementStudio holds up when 100, 250, and 500 statements arrive at the
            same time. The numbers below come from the latest run. If conversions ever take longer
            than two seconds, or a single file goes missing, we hold the release back before it
            reaches you.
          </p>
        </section>

        {benchmark ? (
          <>
            <section className="border-t border-[var(--border)] bg-[var(--surface)]">
              <div className="mx-auto max-w-5xl px-6 py-10 lg:px-8">
                <dl className="grid gap-6 sm:grid-cols-3">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                      Run captured
                    </dt>
                    <dd className="mt-1 font-mono text-sm text-[var(--text-primary)]">
                      {benchmark.generatedAt}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                      Mode
                    </dt>
                    <dd className="mt-1 font-mono text-sm text-[var(--text-primary)]">
                      {benchmark.mode}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                      Lost jobs
                    </dt>
                    <dd className="mt-1 font-mono text-sm text-[var(--text-primary)]">
                      {benchmark.invariants.lostJobs}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="border-t border-[var(--border)]">
              <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
                <h2 className="text-xl font-semibold">Per-concurrency results</h2>
                <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[var(--surface)] text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Concurrent statements</th>
                        <th className="px-4 py-3 text-right font-semibold">Submitted</th>
                        <th className="px-4 py-3 text-right font-semibold">Ready</th>
                        <th className="px-4 py-3 text-right font-semibold">Convert P95</th>
                        <th className="px-4 py-3 text-right font-semibold">Time-to-ready P95</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {benchmark.runs.map((run) => (
                        <tr key={run.concurrency} className="border-t border-[var(--border)]">
                          <td className="px-4 py-3">{run.concurrency}</td>
                          <td className="px-4 py-3 text-right">{run.submitted}</td>
                          <td className="px-4 py-3 text-right">{run.ready}</td>
                          <td className="px-4 py-3 text-right">
                            {formatMs(run.convertAcceptanceP95Ms)}
                          </td>
                          <td className="px-4 py-3 text-right">{formatMs(run.timeToReadyP95Ms)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-xs text-[var(--text-secondary)]">
                  Convert acceptance threshold:{' '}
                  <span className="font-mono">
                    {formatMs(benchmark.runs[0]?.convertAcceptanceP95ThresholdMs)}
                  </span>
                  . Time-to-ready threshold scales per concurrency tier.
                </p>
              </div>
            </section>

            <section className="border-t border-[var(--border)] bg-[var(--surface)]">
              <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
                <h2 className="text-xl font-semibold">What this means for you</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                  Your statement converts in well under two seconds, even during peak hours. You
                  will not be charged twice for the same file, and rows will not be duplicated in
                  your export. The numbers above are real, not targets. Every release has to clear
                  them before it goes live.
                </p>
              </div>
            </section>
          </>
        ) : (
          <section className="border-t border-[var(--border)]">
            <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
              <p className="text-sm text-[var(--text-secondary)]">
                Benchmark evidence is being regenerated. Check back shortly.
              </p>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  )
}

function formatMs(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`
  if (value >= 1) return `${value.toFixed(1)} ms`
  return `${(value * 1000).toFixed(0)} µs`
}
