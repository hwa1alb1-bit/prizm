import type { ReactNode } from 'react'

type TileTone = 'amber' | 'indigo' | 'sky' | 'cyan'

const TONE_TINT: Record<TileTone, { bg: string; ink: string; secondary: string }> = {
  amber: { bg: '#FEF3C7', ink: '#F59E0B', secondary: '#FCD34D' },
  indigo: { bg: '#EEF0FF', ink: '#4F46E5', secondary: '#A5B4FC' },
  sky: { bg: '#E0F2FE', ink: '#0EA5E9', secondary: '#7DD3FC' },
  cyan: { bg: '#CFFAFE', ink: '#0891B2', secondary: '#67E8F9' },
}

type Tile = { title: string; body: string; tone: TileTone; icon: (tone: TileTone) => ReactNode }

function ShieldIcon(tone: TileTone) {
  const { bg, ink, secondary } = TONE_TINT[tone]
  return (
    <svg viewBox="0 0 56 56" aria-hidden="true" className="h-12 w-12">
      <path
        d="M28 6l16 6v12c0 11-7 19-16 22-9-3-16-11-16-22V12l16-6z"
        fill={secondary}
        stroke={ink}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M28 12l11 4v10c0 7-5 13-11 15-6-2-11-8-11-15V16l11-4z"
        fill={bg}
        stroke={ink}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M22 28l4.5 4.5L36 23"
        fill="none"
        stroke={ink}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DocLockIcon(tone: TileTone) {
  const { bg, ink, secondary } = TONE_TINT[tone]
  return (
    <svg viewBox="0 0 56 56" aria-hidden="true" className="h-12 w-12">
      <path
        d="M14 8h22l10 10v28a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"
        fill={bg}
        stroke={ink}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M36 8v10h10" fill="none" stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />
      <rect
        x="20"
        y="28"
        width="16"
        height="12"
        rx="2"
        fill="#FFFFFF"
        stroke={ink}
        strokeWidth="1.8"
      />
      <path
        d="M23 28v-3a5 5 0 0 1 10 0v3"
        fill="none"
        stroke={ink}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="28" cy="34" r="1.6" fill={secondary} />
    </svg>
  )
}

function CloudArrowIcon(tone: TileTone) {
  const { bg, ink, secondary } = TONE_TINT[tone]
  return (
    <svg viewBox="0 0 56 56" aria-hidden="true" className="h-12 w-12">
      <path
        d="M16 38c-5 0-9-4-9-9 0-4 3-8 7-9 1-7 7-12 14-12 6 0 11 3 13 9 1 0 2-1 4-1 6 0 10 4 10 10 0 6-4 12-12 12H16z"
        fill={bg}
        stroke={ink}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M28 22v16 M22 32l6 6 6-6"
        fill="none"
        stroke={ink}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="44" cy="20" r="1.6" fill={secondary} />
    </svg>
  )
}

function ReportIcon(tone: TileTone) {
  const { bg, ink, secondary } = TONE_TINT[tone]
  return (
    <svg viewBox="0 0 56 56" aria-hidden="true" className="h-12 w-12">
      <path
        d="M14 8h22l10 10v28a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"
        fill={bg}
        stroke={ink}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M36 8v10h10" fill="none" stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="16" y="24" width="14" height="3" rx="1.2" fill={ink} />
      <rect x="16" y="30" width="22" height="3" rx="1.2" fill={secondary} />
      <rect x="16" y="36" width="18" height="3" rx="1.2" fill={secondary} />
      <rect x="16" y="42" width="10" height="3" rx="1.2" fill={ink} />
    </svg>
  )
}

const TILES: Tile[] = [
  {
    title: 'Encrypted Connection',
    body: 'Your files are protected during upload and processing with secure TLS 1.2+ encrypted transfer.',
    tone: 'amber',
    icon: ShieldIcon,
  },
  {
    title: 'Files stay private',
    body: 'Uploaded documents remain private, encrypted, and are never shared or used to train AI models.',
    tone: 'indigo',
    icon: DocLockIcon,
  },
  {
    title: 'Rapid processing',
    body: 'Convert bank statements, credit card PDFs, and transaction reports into structured spreadsheet data in seconds.',
    tone: 'sky',
    icon: CloudArrowIcon,
  },
  {
    title: 'Accounting & Bookkeeping Formatted',
    body: 'Convert complex financial PDFs into clean, organized spreadsheet data built for reconciliation, reporting, audits, and bookkeeping.',
    tone: 'cyan',
    icon: ReportIcon,
  },
]

export function TrustCards() {
  return (
    <section aria-labelledby="trust-cards-heading" className="border-t border-[var(--border)]">
      <h2 id="trust-cards-heading" className="sr-only">
        Why teams pick StatementStudio
      </h2>
      <div className="mx-auto grid max-w-7xl gap-4 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {TILES.map((tile) => (
          <article
            key={tile.title}
            data-tile-root="trust"
            className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elevation-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--elevation-hover)]"
          >
            {tile.icon(tile.tone)}
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{tile.title}</h3>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">{tile.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
