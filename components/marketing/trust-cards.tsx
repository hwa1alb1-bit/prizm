import Link from 'next/link'
import { loadLatestBenchmark } from '@/lib/marketing/throughput'

/**
 * Four evidence-rich cards of varying weight. Replaces the prior four-identical-tile grid
 * (impeccable absolute ban on identical card grids). Each card carries one concrete proof
 * point: reconciliation math, throughput numbers, retention policy, security score.
 */
export function TrustCards() {
  const benchmark = loadLatestBenchmark()
  const peakRun = benchmark?.runs.reduce(
    (best, run) => (run.concurrency > (best?.concurrency ?? 0) ? run : best),
    benchmark.runs[0],
  )

  return (
    <section aria-labelledby="trust-cards-heading" className="border-t border-[var(--border)]">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
          Trust, with receipts
        </p>
        <h2
          id="trust-cards-heading"
          className="mt-2 max-w-3xl text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-[var(--text-primary)] sm:text-4xl"
        >
          Every claim on this page is backed by an artifact.
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <article
            data-card="reconciliation"
            className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 md:col-span-2 md:row-span-2"
          >
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Reconciled to the cent
            </h3>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              Every statement runs through deterministic reconciliation math. Opening balance plus
              credits and minus debits has to equal the printed closing balance. If it doesn’t, we
              mark the export with a red flag and tell you which field is off.
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--success-border,var(--border))] bg-[var(--success-soft,var(--surface))] p-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--success,var(--primary))]">
                  Reconciled
                </span>
                <p className="mt-1 font-mono text-sm text-[var(--text-primary)]">
                  reported $1,250.00 = computed $1,250.00
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  Mismatch flagged
                </span>
                <p className="mt-1 font-mono text-sm text-[var(--text-primary)]">
                  reported $1,250.00 ≠ computed $1,247.39
                </p>
              </div>
            </div>
            <Link
              href="/how-we-verify"
              className="self-start text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
            >
              How reconciliation works →
            </Link>
          </article>

          <article
            data-card="throughput"
            className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
          >
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Throughput, measured
            </h3>
            {peakRun ? (
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                P95 conversion acceptance at {peakRun.concurrency} concurrent statements:{' '}
                <span className="font-mono text-[var(--text-primary)]">
                  {formatMs(peakRun.convertAcceptanceP95Ms)}
                </span>
                . Threshold:{' '}
                <span className="font-mono">
                  {formatMs(peakRun.convertAcceptanceP95ThresholdMs)}
                </span>
                .
              </p>
            ) : (
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                Benchmark evidence ships with each release. Numbers update with every gate run.
              </p>
            )}
            <Link
              href="/throughput"
              className="mt-auto self-start text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
            >
              See the full benchmark →
            </Link>
          </article>

          <article
            data-card="retention"
            className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
          >
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Files auto-delete in 24h
            </h3>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              Every upload carries a retention deadline. Once the deadline passes, the PDF and its
              converted output are removed. The audit event is kept.
            </p>
            <Link
              href="/security/policy"
              className="mt-auto self-start text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
            >
              Retention policy →
            </Link>
          </article>

          <article
            data-card="observatory"
            className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
          >
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Mozilla Observatory A+
            </h3>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              Independent third-party security audit of TLS, headers, content-security policy, and
              cross-origin posture. Reverified on every release.
            </p>
            <a
              href="https://observatory.mozilla.org/analyze/pdftoexcelstatementconverter.com"
              target="_blank"
              rel="noreferrer"
              className="mt-auto self-start text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
            >
              View the report →
            </a>
          </article>
        </div>
      </div>
    </section>
  )
}

function formatMs(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`
  if (value >= 1) return `${value.toFixed(1)} ms`
  return `${(value * 1000).toFixed(0)} µs`
}
