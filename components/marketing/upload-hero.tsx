'use client'

import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

type UploadHeroProps = {
  isAuthenticated: boolean
  rightRailExtras?: ReactNode
}

const TRUST_PILLS = ['Secure & private', 'Highly accurate', 'Audit-ready output'] as const

const STATUS_ROWS: { label: string; value: string }[] = [
  { label: 'Filename', value: '—' },
  { label: 'Status', value: 'Waiting for upload' },
  { label: 'Size', value: '—' },
  { label: 'Checked', value: '—' },
  { label: 'Expires', value: '—' },
]

function CheckIcon() {
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

function PdfGlyph() {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="h-14 w-14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M18 8h22l10 10v36a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"
        fill="color-mix(in oklch, var(--accent) 6%, transparent)"
        stroke="var(--accent)"
      />
      <path d="M40 8v10h10" stroke="var(--accent)" />
      <text
        x="32"
        y="42"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="var(--accent)"
        stroke="none"
      >
        PDF
      </text>
    </svg>
  )
}

export function UploadHero({ isAuthenticated, rightRailExtras }: UploadHeroProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const route = isAuthenticated ? '/app' : '/register?next=/app'

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
    setIsDragging(false)
    if (event.dataTransfer.files.length > 0) {
      dispatchFile()
    }
  }

  function openPicker() {
    inputRef.current?.click()
  }

  return (
    <section
      id="features"
      className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,1fr)] lg:items-start lg:gap-12 lg:px-8 lg:py-18"
    >
      <div className="min-w-0">
        <p className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_oklch,var(--accent)_12%,transparent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          <CheckIcon />
          BANK &amp; CREDIT CARD STATEMENT CONVERTER
        </p>

        <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Convert PDF statements
          <br className="hidden sm:block" /> to{' '}
          <span className="text-[var(--accent)]">CSV and Excel</span>
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-7 text-foreground/70 sm:text-lg">
          Fast, accurate, and secure conversion of bank and credit card statements. Get clean data
          you can trust in seconds.
        </p>

        <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-foreground/80">
          {TRUST_PILLS.map((pill) => (
            <li key={pill} className="flex items-center gap-2">
              <CheckIcon />
              <span>{pill}</span>
            </li>
          ))}
        </ul>

        <div
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openPicker()
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Upload PDF statement"
          className={`mt-8 flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            isDragging
              ? 'border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]'
              : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:border-[var(--accent)]'
          }`}
        >
          <PdfGlyph />
          <p className="text-base font-semibold">Drag and drop your PDF statement here</p>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              openPicker()
            }}
            className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:opacity-90 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Choose PDF
          </button>
          <p className="text-xs text-foreground/55">
            One PDF, up to 30 MB · Uploads expire after 10 minutes
          </p>
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

      <div className="space-y-5 lg:sticky lg:top-24">
        <aside
          aria-label="Conversion status"
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-wide">Conversion status</h2>
            <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-foreground/60">
              No file uploaded
            </span>
          </div>
          <dl className="mt-5 divide-y divide-[var(--border-subtle)] text-sm">
            {STATUS_ROWS.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-foreground/60">{row.label}</dt>
                <dd className="font-medium text-foreground/80">{row.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
        {rightRailExtras}
      </div>
    </section>
  )
}
