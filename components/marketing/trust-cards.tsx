type Tile = { title: string; body: string; icon: string; alt: string }

const TILES: Tile[] = [
  {
    title: 'Encrypted Connection',
    body: 'Your files are protected during upload and processing with secure TLS 1.2+ encrypted transfer.',
    icon: '/marketing/icons/chip.png',
    alt: '',
  },
  {
    title: 'Files stay private',
    body: 'Uploaded documents remain private, encrypted, and are never shared or used to train AI models.',
    icon: '/marketing/icons/archive.png',
    alt: '',
  },
  {
    title: 'Rapid processing',
    body: 'Convert bank statements, credit card PDFs, and transaction reports into structured spreadsheet data in seconds.',
    icon: '/marketing/icons/electric.png',
    alt: '',
  },
  {
    title: 'Accounting & Bookkeeping Formatted',
    body: 'Convert complex financial PDFs into clean, organized spreadsheet data built for reconciliation, reporting, audits, and bookkeeping.',
    icon: '/marketing/icons/link.png',
    alt: '',
  },
]

export function TrustCards() {
  return (
    <section aria-labelledby="trust-cards-heading" className="border-t border-[var(--border)]">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
          Why teams pick us
        </p>
        <h2
          id="trust-cards-heading"
          className="mt-2 max-w-3xl text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-[var(--text-primary)] sm:text-4xl"
        >
          Built to handle financial documents without the manual cleanup.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TILES.map((tile) => (
            <article
              key={tile.title}
              data-tile-root="trust"
              className="flex flex-col items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center shadow-[var(--elevation-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--elevation-hover)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tile.icon}
                alt={tile.alt}
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
              />
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{tile.title}</h3>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">{tile.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
