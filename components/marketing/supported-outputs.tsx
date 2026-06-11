const OUTPUTS = ['CSV', 'Excel (XLSX)', 'QuickBooks CSV', 'Xero CSV'] as const

function CheckMark() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12l4.5 4.5L19 7" />
      </svg>
    </span>
  )
}

export function SupportedOutputs() {
  return (
    <section
      aria-labelledby="supported-outputs-heading"
      className="flex h-full flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elevation-card)]"
    >
      <h3
        id="supported-outputs-heading"
        className="text-sm font-semibold tracking-wide text-[var(--text-primary)]"
      >
        Supported outputs
      </h3>
      <ul className="mt-4 flex-1 space-y-3 text-sm">
        {OUTPUTS.map((format) => (
          <li key={format} className="flex items-center gap-3">
            <CheckMark />
            <span className="font-medium text-[var(--text-primary)]">{format}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        Pick the format your accounting workflow expects after review.
      </p>
    </section>
  )
}
