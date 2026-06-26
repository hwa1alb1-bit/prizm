import { OUTPUTS } from './output-formats'

function CheckCircle() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-[var(--primary)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" fill="var(--primary-soft)" />
      <path d="M8 12.5l2.6 2.6L16 9.5" />
    </svg>
  )
}

export function LandingHeroCopy() {
  return (
    <div className="min-w-0">
      <p className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
        <CheckCircle />
        BANK &amp; CREDIT CARD STATEMENT CONVERTER
      </p>

      <h1 className="mt-6 font-bold leading-[1.04] tracking-[-0.03em] text-[var(--text-primary)] text-[clamp(2.25rem,5.5vw,4.25rem)]">
        Turn PDF Statements into <span className="text-[var(--primary)]">QuickBooks and Xero</span>
        <wbr />
        -Ready Files
      </h1>

      <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
        Convert bank, credit card, and financial statements into clean transaction files for
        QuickBooks, Xero, CSV, and Excel, without manual data entry.
      </p>

      <ul
        aria-label="Supported export formats"
        className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-medium text-[var(--text-secondary)]"
      >
        {OUTPUTS.map((format) => (
          <li key={format.label} className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={format.icon}
              alt={format.alt}
              width={20}
              height={20}
              className="h-5 w-5 shrink-0 rounded-sm object-contain"
            />
            <span>{format.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
