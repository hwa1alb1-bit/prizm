export type StatusPillVariant = 'empty' | 'uploading' | 'processing' | 'ready' | 'failed'

type StatusPillProps = {
  variant: StatusPillVariant
  label?: string
}

const VARIANT_DEFAULTS: Record<StatusPillVariant, string> = {
  empty: 'No file uploaded',
  uploading: 'Uploading',
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed',
}

const VARIANT_STYLES: Record<StatusPillVariant, string> = {
  empty: 'bg-[var(--surface-muted)] text-[var(--text-secondary)]',
  uploading: 'bg-[var(--primary-soft)] text-[var(--primary-active)]',
  processing: 'bg-[var(--primary-soft)] text-[var(--primary-active)]',
  ready: 'bg-[var(--surface-success-soft)] text-[var(--success)]',
  failed: 'bg-[var(--surface-danger-soft)] text-[var(--error)]',
}

const DOT_STYLES: Record<StatusPillVariant, string> = {
  empty: 'bg-[var(--text-muted)]',
  uploading: 'bg-[var(--primary)] animate-pulse',
  processing: 'bg-[var(--primary)] animate-pulse',
  ready: 'bg-[var(--success)]',
  failed: 'bg-[var(--error)]',
}

export function StatusPill({ variant, label }: StatusPillProps) {
  const text = label ?? VARIANT_DEFAULTS[variant]
  return (
    <span
      data-variant={variant}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${VARIANT_STYLES[variant]}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[variant]}`} />
      {text}
    </span>
  )
}
