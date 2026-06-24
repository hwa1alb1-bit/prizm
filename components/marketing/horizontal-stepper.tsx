import type { ReactNode } from 'react'

export type HorizontalStepperStatus = 'complete' | 'active' | 'waiting' | 'blocked'

export type HorizontalStepperStep = {
  id: string
  label: string
  sublabel?: string
  status: HorizontalStepperStatus
}

type Props = {
  steps: HorizontalStepperStep[]
  ariaLabel: string
}

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5l4 4 10-10" />
    </svg>
  )
}

function CrossGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  )
}

function nodeClass(status: HorizontalStepperStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-[var(--success)] text-white border-[var(--success)]'
    case 'active':
      return 'bg-[var(--primary)] text-white border-[var(--primary)] ring-4 ring-[color-mix(in_oklch,var(--primary)_28%,transparent)]'
    case 'blocked':
      return 'bg-[var(--error)] text-white border-[var(--error)]'
    case 'waiting':
    default:
      return 'bg-transparent text-[var(--text-muted)] border-[var(--border-strong)]'
  }
}

function railColorFor(status: HorizontalStepperStatus | undefined): string {
  switch (status) {
    case 'complete':
    case 'active':
      return 'bg-[var(--success)]'
    case 'blocked':
      return 'bg-[var(--error)]'
    case 'waiting':
    default:
      return 'bg-[var(--border)]'
  }
}

function nodeGlyph(status: HorizontalStepperStatus, index: number): ReactNode {
  if (status === 'blocked') return <CrossGlyph />
  if (status === 'complete' || status === 'active') return <CheckGlyph />
  return <span className="text-sm font-semibold">{index + 1}</span>
}

function statusLabel(status: HorizontalStepperStatus): string {
  switch (status) {
    case 'complete':
      return 'complete'
    case 'active':
      return 'in progress'
    case 'blocked':
      return 'blocked'
    case 'waiting':
    default:
      return 'pending'
  }
}

export function HorizontalStepper({ steps, ariaLabel }: Props) {
  return (
    <ol aria-label={ariaLabel} className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-0">
      {steps.map((step, index) => {
        const isFirst = index === 0
        const isLast = index === steps.length - 1
        const prevStatus = steps[index - 1]?.status
        const nextStatus = steps[index + 1]?.status
        const railLeftClass = isFirst
          ? 'sm:invisible'
          : railColorFor(step.status === 'waiting' ? 'waiting' : prevStatus)
        const railRightClass = isLast ? 'sm:invisible' : railColorFor(nextStatus)
        return (
          <li
            key={step.id}
            className="flex flex-row items-start gap-3 sm:flex-1 sm:flex-col sm:items-stretch sm:gap-0"
            aria-current={step.status === 'active' ? 'step' : undefined}
          >
            <div className="flex items-center sm:w-full sm:justify-center">
              <span
                aria-hidden="true"
                className={`hidden sm:block sm:h-0.5 sm:flex-1 sm:rounded-full ${railLeftClass}`}
              />
              <span
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${nodeClass(step.status)}`}
              >
                {nodeGlyph(step.status, index)}
                <span className="sr-only">{statusLabel(step.status)}</span>
              </span>
              <span
                aria-hidden="true"
                className={`hidden sm:block sm:h-0.5 sm:flex-1 sm:rounded-full ${railRightClass}`}
              />
            </div>
            <div className="min-w-0 sm:mt-3 sm:w-full sm:px-2 sm:text-center">
              <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">
                {step.label}
              </p>
              {step.sublabel ? (
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{step.sublabel}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
