const OUTPUTS = ['CSV', 'Excel (XLSX)', 'QuickBooks CSV', 'Xero CSV'] as const

function CheckMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-[var(--accent)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" fill="color-mix(in oklch, var(--accent) 14%, transparent)" />
      <path d="M8 12.5l2.6 2.6L16 9.5" />
    </svg>
  )
}

export function SupportedOutputs() {
  return (
    <section
      aria-labelledby="supported-outputs-heading"
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5"
    >
      <h3 id="supported-outputs-heading" className="text-sm font-semibold tracking-wide">
        Supported outputs
      </h3>
      <ul className="mt-4 space-y-3 text-sm">
        {OUTPUTS.map((format) => (
          <li key={format} className="flex items-center gap-3">
            <CheckMark />
            <span className="font-medium">{format}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
