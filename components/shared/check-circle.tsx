type Tone = 'primary' | 'success'

const TONE_STYLES: Record<Tone, { stroke: string; fill: string }> = {
  primary: { stroke: 'text-[var(--primary)]', fill: 'var(--primary-soft)' },
  success: { stroke: 'text-[var(--success)]', fill: 'var(--surface-success-soft)' },
}

export function CheckCircle({
  tone = 'primary',
  className = 'h-4 w-4',
}: {
  tone?: Tone
  className?: string
}) {
  const { stroke, fill } = TONE_STYLES[tone]
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`${className} shrink-0 ${stroke}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" fill={fill} />
      <path d="M8 12.5l2.6 2.6L16 9.5" />
    </svg>
  )
}
