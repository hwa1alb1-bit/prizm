export default function HistoryLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8" aria-busy="true" aria-live="polite">
      <header className="grid gap-4 border-b border-[var(--border-subtle)] pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/50">
            Statement history
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Review and evidence</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/65">
            PRIZM is loading document evidence and audit records for your statement history.
          </p>
        </div>
      </header>

      <div className="space-y-3">
        <nav className="flex flex-wrap gap-2" aria-label="History queue filters loading">
          {['All', 'Processing', 'Ready', 'Failed', 'Expiring soon'].map((label, index) => (
            <div
              key={label}
              className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium ${
                index === 0
                  ? 'border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_10%,transparent)]'
                  : 'border-[var(--border-subtle)] bg-background'
              }`}
            >
              <span>{label}</span>
              <span className="h-3 w-4 rounded bg-[var(--surface-strong)]" />
            </div>
          ))}
        </nav>

        <section className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-left text-sm">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs uppercase tracking-[0.08em] text-foreground/45">
                <tr>
                  <th className="px-4 py-3 font-semibold">Statement</th>
                  <th className="px-4 py-3 font-semibold">Queue state</th>
                  <th className="px-4 py-3 font-semibold">Evidence timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {['OCR evidence pending', 'Audit records pending', 'Retention proof pending'].map(
                  (status, index) => (
                    <tr key={status}>
                      <td className="px-4 py-4 align-top">
                        <SkeletonLine className={index === 1 ? 'w-44' : 'w-56'} />
                        <SkeletonLine className="mt-2 w-32" muted />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex min-h-7 items-center rounded-full bg-[var(--surface-muted)] px-2.5 text-xs font-semibold text-foreground/60">
                          {status}
                        </span>
                        <SkeletonLine className="mt-3 w-36" muted />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-2" aria-label="Evidence timeline loading">
                          {[
                            'Upload requested',
                            'S3 object verified',
                            'OCR started',
                            'OCR completed',
                            'Statement extracted',
                            'Export generated',
                            'Deletion completed',
                          ].map((label, stepIndex) => (
                            <div
                              key={`${status}:${label}`}
                              className="grid grid-cols-[0.75rem_minmax(0,8.5rem)_minmax(0,1fr)] gap-2 text-xs"
                            >
                              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--surface-strong)]" />
                              <span className="font-medium text-foreground">{label}</span>
                              <SkeletonLine
                                className={stepIndex < index + 2 ? 'w-28' : 'w-44'}
                                muted={stepIndex >= index + 2}
                              />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

function SkeletonLine({ className, muted = false }: { className: string; muted?: boolean }) {
  return (
    <div
      className={`h-3 rounded-sm ${muted ? 'bg-[var(--surface-muted)]' : 'bg-[var(--surface-strong)]'} ${className}`}
    />
  )
}
