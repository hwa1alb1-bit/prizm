import { StatusPill, type StatusPillVariant } from './status-pill'

type ConversionStatusCardProps = {
  variant: StatusPillVariant
  filename?: string
  sizeLabel?: string
  checkedLabel?: string
  expiresLabel?: string
}

const STATUS_TEXT: Record<StatusPillVariant, string> = {
  empty: 'Waiting for upload',
  uploading: 'Uploading…',
  processing: 'Extracting data…',
  ready: 'Ready to download',
  failed: 'Conversion failed',
}

export function ConversionStatusCard({
  variant,
  filename,
  sizeLabel,
  checkedLabel,
  expiresLabel,
}: ConversionStatusCardProps) {
  const dash = '—'
  const rows: { label: string; value: string }[] = [
    { label: 'Filename', value: filename ?? dash },
    { label: 'Status', value: STATUS_TEXT[variant] },
    { label: 'Size', value: sizeLabel ?? dash },
    { label: 'Checked', value: checkedLabel ?? dash },
    { label: 'Expires', value: expiresLabel ?? dash },
  ]

  return (
    <section
      aria-label="Conversion status"
      data-card="conversion-status"
      data-variant={variant}
      style={{ minHeight: '17rem' }}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elevation-card)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--text-primary)]">
          Conversion status
        </h2>
        <StatusPill variant={variant} />
      </div>
      <dl className="mt-5 divide-y divide-[var(--border)] text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-[var(--text-muted)]">{row.label}</dt>
            <dd className="font-medium text-[var(--text-primary)]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
