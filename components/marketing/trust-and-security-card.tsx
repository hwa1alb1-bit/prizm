type TrustRow = {
  label: string
  tone: 'shield' | 'lock' | 'clock' | 'no'
}

const TRUST_ROWS: TrustRow[] = [
  { label: 'Bank-level encryption (TLS 1.2+)', tone: 'shield' },
  { label: 'Files are private and encrypted', tone: 'lock' },
  { label: 'Auto delete after 24 hours', tone: 'clock' },
  { label: 'No data used for training or shared', tone: 'no' },
]

function TrustIcon({ kind }: { kind: TrustRow['tone'] }) {
  const paths = {
    shield: (
      <path d="M12 3l8 3v6c0 4.5-3.4 8.5-8 9-4.6-.5-8-4.5-8-9V6l8-3z M9 12.5l2.2 2.2L15 11" />
    ),
    lock: <path d="M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v9H5z M12 15v2" />,
    clock: <path d="M12 7v5l3 2 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z" />,
    no: <path d="M5 12a7 7 0 1 0 14 0 7 7 0 0 0-14 0z M7 7l10 10" />,
  } as const
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)]">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4 text-[var(--primary)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths[kind]}
      </svg>
    </span>
  )
}

export function TrustAndSecurityCard() {
  return (
    <section
      aria-labelledby="trust-security-heading"
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elevation-card)]"
    >
      <h3
        id="trust-security-heading"
        className="text-sm font-semibold tracking-wide text-[var(--text-primary)]"
      >
        Trust &amp; security
      </h3>
      <ul className="mt-4 space-y-3 text-sm">
        {TRUST_ROWS.map((row) => (
          <li key={row.label} className="flex items-center gap-3">
            <TrustIcon kind={row.tone} />
            <span className="font-medium text-[var(--text-primary)]">{row.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
