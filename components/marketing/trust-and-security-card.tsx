const TRUST_ROWS = [
  'TLS 1.2+ encryption in transit',
  'Files are private and encrypted',
  'Auto delete after 24 hours',
  'No data used for training or shared',
] as const

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
      <path d="M5 12l4.5 4.5L19 7" />
    </svg>
  )
}

export function TrustAndSecurityCard() {
  return (
    <section
      id="security"
      aria-labelledby="trust-security-heading"
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5"
    >
      <h3 id="trust-security-heading" className="text-sm font-semibold tracking-wide">
        Trust &amp; security
      </h3>
      <ul className="mt-4 space-y-3 text-sm">
        {TRUST_ROWS.map((row) => (
          <li key={row} className="flex items-center gap-3">
            <CheckMark />
            <span className="font-medium">{row}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
