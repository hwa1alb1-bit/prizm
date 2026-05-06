export default function DocumentReviewLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6" aria-busy="true" aria-live="polite">
      <header className="grid gap-4 border-b border-[var(--border-subtle)] pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-sm font-medium text-[var(--accent)]">History</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Document review</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/65">
            PRIZM is loading document evidence, extracted rows, and audit records for this review.
          </p>
        </div>
        <span className="inline-flex min-h-7 w-fit items-center rounded-full bg-[var(--surface-muted)] px-2.5 text-xs font-semibold text-foreground/60">
          Evidence pending
        </span>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-5">
          <EvidenceTimelineSkeleton />
          <EvidenceSkeleton title="Statement summary" rows={6} columns="sm:grid-cols-2" />
          <TransactionTableSkeleton />
          <EvidenceSkeleton title="Exceptions" rows={2} />
          <EvidenceSkeleton title="Reconciliation result" rows={4} columns="sm:grid-cols-2" />
          <EvidenceSkeleton title="Export readiness" rows={3} columns="sm:grid-cols-2" />
          <AuditTrailSkeleton />
        </div>

        <aside className="space-y-5">
          <EvidenceSkeleton title="Document record" rows={6} columns="sm:grid-cols-2" />
          <EvidenceSkeleton title="Review position" rows={4} />
        </aside>
      </div>
    </div>
  )
}

function EvidenceTimelineSkeleton() {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] p-4 sm:p-5">
      <h2 className="text-base font-semibold">Evidence timeline</h2>
      <p className="mt-2 text-sm leading-6 text-foreground/65">
        PRIZM is loading what it has already proven and the next document event it is waiting on.
      </p>
      <ol className="mt-4 grid gap-3" aria-label="Evidence timeline loading">
        {[
          'Upload requested',
          'S3 object verified',
          'OCR started',
          'OCR completed',
          'Statement extracted',
          'Export generated',
          'Deletion completed',
        ].map((label, index) => (
          <li
            key={label}
            className="rounded-lg border border-[var(--border-subtle)] bg-background p-3"
          >
            <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-start">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--surface-strong)]" />
                <p className="text-sm font-semibold">{label}</p>
              </div>
              <SkeletonLine className={index < 3 ? 'w-72 max-w-full' : 'w-56 max-w-full'} />
              <span className="inline-flex min-h-7 w-fit items-center rounded-full bg-[var(--surface-muted)] px-2.5 text-xs font-semibold text-foreground/60">
                Loading
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function EvidenceSkeleton({
  title,
  rows,
  columns,
}: {
  title: string
  rows: number
  columns?: string
}) {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] p-4 sm:p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <dl className={`mt-4 grid gap-3 text-sm ${columns ?? ''}`}>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={`${title}:${index}`}>
            <SkeletonLine className={index % 2 === 0 ? 'w-24' : 'w-32'} muted />
            <SkeletonLine className={index % 3 === 0 ? 'mt-2 w-48' : 'mt-2 w-36'} />
          </div>
        ))}
      </dl>
    </section>
  )
}

function TransactionTableSkeleton() {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] p-4 sm:p-5">
      <h2 className="text-base font-semibold">Transaction table</h2>
      <p className="mt-2 text-sm leading-6 text-foreground/65">
        PRIZM is loading extracted transaction evidence for this statement.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[76rem] text-left text-sm">
          <thead className="border-y border-[var(--border-subtle)] text-xs uppercase tracking-[0.08em] text-foreground/45">
            <tr>
              <th className="py-2 pr-4 font-semibold">Date</th>
              <th className="py-2 pr-4 font-semibold">Description</th>
              <th className="py-2 pr-4 text-right font-semibold">Debit</th>
              <th className="py-2 pr-4 text-right font-semibold">Credit</th>
              <th className="py-2 pr-4 text-right font-semibold">Amount</th>
              <th className="py-2 pr-4 text-right font-semibold">Balance</th>
              <th className="py-2 pr-4 font-semibold">Evidence</th>
              <th className="py-2 font-semibold">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {Array.from({ length: 3 }).map((_, index) => (
              <tr key={index}>
                {Array.from({ length: 8 }).map((__, cellIndex) => (
                  <td key={cellIndex} className="py-3 pr-4 align-top">
                    <SkeletonLine
                      className={
                        cellIndex === 1
                          ? 'w-64'
                          : cellIndex > 1 && cellIndex < 6
                            ? 'ml-auto w-20'
                            : 'w-28'
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AuditTrailSkeleton() {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] p-4 sm:p-5">
      <h2 className="text-base font-semibold">Audit trail</h2>
      <ol className="mt-4 divide-y divide-[var(--border-subtle)]">
        {['document.upload_completed', 'document.processing_started', 'document.ready'].map(
          (eventType) => (
            <li key={eventType} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-foreground/70">{eventType}</p>
                <SkeletonLine className="w-32" muted />
              </div>
              <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                {['Request', 'Trace ID', 'Actor'].map((label) => (
                  <div key={`${eventType}:${label}`}>
                    <dt className="text-foreground/50">{label}</dt>
                    <dd className="mt-1">
                      <SkeletonLine className="w-28" />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ),
        )}
      </ol>
    </section>
  )
}

function SkeletonLine({ className, muted = false }: { className: string; muted?: boolean }) {
  return (
    <div
      className={`h-3 rounded-sm ${muted ? 'bg-[var(--surface-muted)]' : 'bg-[var(--surface-strong)]'} ${className}`}
    />
  )
}
