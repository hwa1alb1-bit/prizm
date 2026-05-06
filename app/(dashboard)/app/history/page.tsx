import Link from 'next/link'

const reviewStates = [
  {
    state: 'Processing',
    userNeed: 'Know OCR is running and the file is inside the 24-hour window.',
    evidence: 'Document ID, upload timestamp, trace ID.',
  },
  {
    state: 'Ready for review',
    userNeed: 'Compare extracted rows, spot exceptions, and export when reconciled.',
    evidence: 'Page count, exception count, computed total.',
  },
  {
    state: 'Exported',
    userNeed: 'Know which output was delivered and when it expires.',
    evidence: 'Export timestamp, request ID, retention deadline.',
  },
  {
    state: 'Deleted',
    userNeed: 'Prove that stored input and extracted output were removed.',
    evidence: 'Deletion receipt, audit timestamp, S3 absent check.',
  },
]

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="border-b border-[var(--border-subtle)] pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/50">
          Statement history
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Review and evidence</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/65">
          Converted statements will appear here with review status, export readiness, retention
          windows, and deletion evidence.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-6">
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold">No statements yet</h2>
            <p className="mt-2 text-sm leading-6 text-foreground/65">
              Upload a PDF statement to create the first document record. PRIZM will show
              processing, review, export, and deletion states here as the workflow advances.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/app"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Upload statement
              </Link>
              <Link
                href="/app/settings"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                Check workspace settings
              </Link>
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-[var(--border-subtle)] p-4">
          <h2 className="text-base font-semibold">Evidence kept with each statement</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-foreground/50">Retention deadline</dt>
              <dd className="font-medium">Exact expiration time</dd>
            </div>
            <div>
              <dt className="text-foreground/50">Traceability</dt>
              <dd className="font-medium">Request ID and trace ID</dd>
            </div>
            <div>
              <dt className="text-foreground/50">Deletion proof</dt>
              <dd className="font-medium">Receipt and audit timestamp</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="rounded-lg border border-[var(--border-subtle)] p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold">Review state model</h2>
          <p className="mt-1 text-sm text-foreground/60">
            These are the states the history table should expose as records become available.
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-y border-[var(--border-subtle)] text-xs uppercase tracking-[0.08em] text-foreground/45">
              <tr>
                <th className="py-2 pr-4 font-semibold">State</th>
                <th className="py-2 pr-4 font-semibold">User needs to know</th>
                <th className="py-2 font-semibold">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {reviewStates.map((item) => (
                <tr key={item.state}>
                  <td className="py-3 pr-4 font-medium">{item.state}</td>
                  <td className="py-3 pr-4 text-foreground/65">{item.userNeed}</td>
                  <td className="py-3 text-foreground/65">{item.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
