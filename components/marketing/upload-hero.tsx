'use client'

import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ConversionStatusCard } from './conversion-status-card'

export type UploadStatus =
  | { kind: 'idle' }
  | { kind: 'dragover' }
  | { kind: 'uploading'; progress: number; filename: string; sizeLabel: string }
  | { kind: 'processing'; filename: string; sizeLabel: string }
  | { kind: 'success'; filename: string; sizeLabel: string; rows: number }
  | { kind: 'error'; message: string }
  | { kind: 'disabled' }

type UploadHeroProps = {
  isAuthenticated: boolean
  rightRailExtras?: ReactNode
  initialStatus?: UploadStatus
}

const TRUST_PILLS = ['Secure & private', 'Highly accurate', 'Audit-ready output'] as const

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

function PdfGlyph() {
  return (
    <svg viewBox="0 0 96 80" aria-hidden="true" className="h-20 w-24" fill="none">
      {/* Soft lavender cloud silhouette */}
      <path
        d="M20 56c-7 0-12-5-12-12 0-6 4-11 10-12 1-9 9-16 18-16 8 0 14 4 17 11 2-1 4-1 6-1 8 0 14 6 14 14 0 8-6 14-14 14H20z"
        fill="#EEF0FF"
      />
      {/* White document, folded corner top-right */}
      <g transform="translate(28 14)">
        <path
          d="M4 0h26l10 10v44a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4z"
          fill="#FFFFFF"
          stroke="#C9C2FF"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M30 0v10h10"
          fill="#F3F1FF"
          stroke="#C9C2FF"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* Stylized red Acrobat-like mark */}
        <path
          d="M14 22c0-1 1-2 2-2h6c2 0 4 1 4 4 0 3-2 5-5 5h-3v4h-4V22z M18 26h3c0.7 0 1-0.4 1-1 0-0.6-0.3-1-1-1h-3v2z"
          fill="#DC2626"
        />
        <rect x="6" y="40" width="28" height="9" rx="2" fill="#DC2626" />
        <text
          x="20"
          y="46.8"
          textAnchor="middle"
          fontSize="6.4"
          fontWeight="800"
          fill="#FFFFFF"
          fontFamily="sans-serif"
          letterSpacing="0.5"
        >
          PDF
        </text>
      </g>
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6 animate-spin text-[var(--primary)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  )
}

function bodyForStatus(status: UploadStatus): string {
  switch (status.kind) {
    case 'idle':
      return 'Drag and drop your PDF statement here'
    case 'dragover':
      return 'Drop your PDF to start conversion'
    case 'uploading':
      return 'Uploading…'
    case 'processing':
      return 'Extracting data…'
    case 'success':
      return `${status.filename} · ${status.rows} rows ready`
    case 'error':
      return status.message
    case 'disabled':
      return 'Uploads paused'
  }
}

function pillVariant(
  status: UploadStatus,
): 'empty' | 'uploading' | 'processing' | 'ready' | 'failed' {
  switch (status.kind) {
    case 'idle':
    case 'dragover':
    case 'disabled':
      return 'empty'
    case 'uploading':
      return 'uploading'
    case 'processing':
      return 'processing'
    case 'success':
      return 'ready'
    case 'error':
      return 'failed'
  }
}

const VALID_DEMO_STATES: UploadStatus[] = [
  { kind: 'idle' },
  { kind: 'dragover' },
  { kind: 'uploading', progress: 60, filename: 'demo-statement.pdf', sizeLabel: '1.4 MB' },
  { kind: 'processing', filename: 'demo-statement.pdf', sizeLabel: '1.4 MB' },
  { kind: 'success', filename: 'demo-statement.pdf', sizeLabel: '1.4 MB', rows: 128 },
  { kind: 'error', message: 'We could not read this file. Try a different PDF.' },
  { kind: 'disabled' },
]

function parseDemoStatus(value: string | null): UploadStatus | null {
  if (!value) return null
  const match = VALID_DEMO_STATES.find((state) => state.kind === value)
  return match ?? null
}

export function UploadHero({ isAuthenticated, rightRailExtras, initialStatus }: UploadHeroProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<UploadStatus>(
    () => initialStatus ?? parseDemoStatus(searchParams.get('demo')) ?? { kind: 'idle' },
  )

  const route = isAuthenticated ? '/app' : '/register?next=/app'
  const isInteractive =
    status.kind === 'idle' || status.kind === 'dragover' || status.kind === 'error'

  function dispatchFile() {
    router.push(route)
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      dispatchFile()
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (status.kind === 'dragover') setStatus({ kind: 'idle' })
    if (event.dataTransfer.files.length > 0) {
      dispatchFile()
    }
  }

  function openPicker() {
    if (!isInteractive) return
    inputRef.current?.click()
  }

  function resetToIdle() {
    setStatus({ kind: 'idle' })
  }

  const dropzoneClass =
    status.kind === 'dragover'
      ? 'border-[var(--primary)] bg-[var(--primary-soft)] shadow-[var(--elevation-hover)]'
      : status.kind === 'uploading' || status.kind === 'processing'
        ? 'border-[var(--primary)] bg-[var(--surface)]'
        : status.kind === 'success'
          ? 'border-[var(--success)] bg-[var(--surface-success-soft)]'
          : status.kind === 'error'
            ? 'border-[var(--error)] bg-[var(--surface)]'
            : status.kind === 'disabled'
              ? 'border-[var(--border)] bg-[var(--surface-muted)] opacity-70'
              : 'border-[var(--border)] bg-[var(--surface-soft)] hover:border-[var(--border-strong)] hover:bg-[var(--primary-soft)]/60 hover:shadow-[var(--elevation-hover)]'

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,1fr)] lg:items-start lg:gap-12 lg:px-8 lg:py-18">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
          <CheckCircle />
          BANK &amp; CREDIT CARD STATEMENT CONVERTER
        </p>

        <h1 className="mt-6 font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] text-[clamp(2rem,5vw,4rem)]">
          Convert PDF statements
          <br className="hidden sm:block" /> to{' '}
          <span className="text-[var(--primary)]">CSV and Excel</span>
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
          Fast, accurate, and secure conversion of bank and credit card statements. Get clean data
          you can trust in seconds.
        </p>

        <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-[var(--text-secondary)]">
          {TRUST_PILLS.map((pill) => (
            <li key={pill} className="flex items-center gap-2">
              <CheckCircle />
              <span>{pill}</span>
            </li>
          ))}
        </ul>

        <div
          onDragOver={(event) => {
            if (!isInteractive) return
            event.preventDefault()
            if (status.kind !== 'dragover') setStatus({ kind: 'dragover' })
          }}
          onDragLeave={() => {
            if (status.kind === 'dragover') setStatus({ kind: 'idle' })
          }}
          onDrop={onDrop}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (!isInteractive) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openPicker()
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Upload PDF statement"
          aria-disabled={!isInteractive}
          data-status={status.kind}
          style={{ minHeight: '18rem' }}
          className={`mt-8 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] ${dropzoneClass}`}
        >
          {status.kind === 'uploading' || status.kind === 'processing' ? (
            <Spinner />
          ) : status.kind === 'success' ? (
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success)] text-white">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l4.5 4.5L19 7" />
              </svg>
            </span>
          ) : status.kind === 'error' ? (
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-danger-soft)] text-[var(--error)]">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 8v5M12 17h.01" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </span>
          ) : (
            <PdfGlyph />
          )}

          <p className="text-base font-semibold text-[var(--text-primary)]">
            {bodyForStatus(status)}
          </p>

          {status.kind === 'uploading' ? (
            <div className="w-full max-w-sm">
              <div
                role="progressbar"
                aria-label="Upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={status.progress}
                className="h-2 overflow-hidden rounded-full bg-[var(--primary-soft)]"
              >
                <div
                  className="h-full bg-[var(--primary)] transition-[width] duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, status.progress))}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                {status.filename} · {status.sizeLabel}
              </p>
            </div>
          ) : null}

          {status.kind === 'success' ? (
            <Link
              href="/app"
              className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--success)] px-5 text-sm font-semibold text-white transition hover:opacity-90 active:translate-y-px focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
            >
              View result
            </Link>
          ) : null}

          {status.kind === 'error' ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                resetToIdle()
              }}
              className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] active:translate-y-px focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
            >
              Try again
            </button>
          ) : null}

          {status.kind === 'idle' || status.kind === 'dragover' || status.kind === 'disabled' ? (
            <button
              type="button"
              disabled={status.kind === 'disabled'}
              onClick={(event) => {
                event.stopPropagation()
                openPicker()
              }}
              className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[var(--text-muted)] disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
            >
              Choose PDF
            </button>
          ) : null}

          {status.kind !== 'success' && status.kind !== 'error' ? (
            <p className="text-xs text-[var(--text-muted)]">
              One PDF, up to 30 MB · Uploads expire after 10 minutes
            </p>
          ) : null}

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={onChange}
          />
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:self-stretch">
        <ConversionStatusCard
          variant={pillVariant(status)}
          filename={
            status.kind === 'uploading' || status.kind === 'processing' || status.kind === 'success'
              ? status.filename
              : undefined
          }
          sizeLabel={
            status.kind === 'uploading' || status.kind === 'processing' || status.kind === 'success'
              ? status.sizeLabel
              : undefined
          }
        />
        {rightRailExtras ? <div className="flex flex-1 flex-col">{rightRailExtras}</div> : null}
      </div>
    </section>
  )
}
