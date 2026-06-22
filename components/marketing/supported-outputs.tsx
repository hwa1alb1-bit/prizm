type Format = { label: string; icon: string; alt: string }

const OUTPUTS: Format[] = [
  { label: 'CSV', icon: '/marketing/logos/excel.png', alt: 'Microsoft Excel CSV' },
  { label: 'Excel (XLSX)', icon: '/marketing/logos/excel.png', alt: 'Microsoft Excel XLSX' },
  { label: 'QuickBooks CSV', icon: '/marketing/logos/quickbooks.png', alt: 'QuickBooks' },
  { label: 'Xero CSV', icon: '/marketing/logos/xero.png', alt: 'Xero' },
]

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
          <li key={format.label} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={format.icon}
              alt={format.alt}
              width={24}
              height={24}
              className="h-6 w-6 shrink-0 rounded-sm object-contain"
            />
            <span className="font-medium text-[var(--text-primary)]">{format.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        Pick the format your accounting workflow expects after review.
      </p>
    </section>
  )
}
