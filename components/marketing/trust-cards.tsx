import type { ReactNode } from 'react'

type TileIcon = 'shield' | 'check' | 'bolt' | 'document'

const TILES: { title: string; body: string; icon: TileIcon }[] = [
  {
    title: 'Secure by design',
    body: 'Your files are encrypted in transit and at rest. We never store your data longer than necessary.',
    icon: 'shield',
  },
  {
    title: 'Highly accurate',
    body: 'Advanced extraction technology delivers accurate results, even from complex statements.',
    icon: 'check',
  },
  {
    title: 'Blazing fast',
    body: 'Get your converted data in seconds, not hours.',
    icon: 'bolt',
  },
  {
    title: 'Audit-ready',
    body: 'Clean, consistent data ready for accounting, reporting, and reconciliation.',
    icon: 'document',
  },
]

function TileIconSvg({ kind }: { kind: TileIcon }) {
  const paths: Record<TileIcon, ReactNode> = {
    shield: (
      <path d="M12 3l8 3v6c0 4.5-3.4 8.5-8 9-4.6-.5-8-4.5-8-9V6l8-3z M9 12.5l2.2 2.2L15 11" />
    ),
    check: <path d="M7 3h9l4 4v14H7z M16 3v4h4 M9 13l2.3 2.3L15 11.6" />,
    bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />,
    document: <path d="M7 3h9l4 4v14H7z M16 3v4h4 M9 13h6 M9 17h6" />,
  }
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-soft)]">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5 text-[var(--primary)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths[kind]}
      </svg>
    </span>
  )
}

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
            className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elevation-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--elevation-hover)]"
          >
            <TileIconSvg kind={tile.icon} />
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{tile.title}</h3>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">{tile.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
