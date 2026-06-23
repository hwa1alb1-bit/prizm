import Link from 'next/link'

type TrustTile = {
  key: string
  icon: string
  title: string
  body: string
  link: { href: string; label: string; external?: boolean }
}

const TILES: TrustTile[] = [
  {
    key: 'reconciliation',
    icon: '/marketing/icons/coin.png',
    title: 'Reconciled to the cent',
    body: 'Deterministic math. Opening plus credits minus debits has to equal the printed close, or we flag the export.',
    link: { href: '/how-we-verify', label: 'How reconciliation works →' },
  },
  {
    key: 'throughput',
    icon: '/marketing/icons/chart.png',
    title: 'Throughput, measured',
    body: 'P95 acceptance latency from the live benchmark gate, published with every release.',
    link: { href: '/throughput', label: 'See the full benchmark →' },
  },
  {
    key: 'retention',
    icon: '/marketing/icons/error.png',
    title: 'Files auto-delete in 24h',
    body: 'PDF and converted output are removed once the retention deadline passes. The audit event stays.',
    link: { href: '/security/policy', label: 'Retention policy →' },
  },
  {
    key: 'observatory',
    icon: '/marketing/icons/password.png',
    title: 'Mozilla Observatory A+',
    body: 'Independent third-party audit of TLS, headers, CSP, and cross-origin posture. Reverified each release.',
    link: {
      href: 'https://observatory.mozilla.org/analyze/pdftoexcelstatementconverter.com',
      label: 'View the report →',
      external: true,
    },
  },
]

export function TrustCards() {
  return (
    <section aria-labelledby="trust-cards-heading" className="border-t border-[var(--border)]">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
          Trust, with receipts
        </p>
        <h2
          id="trust-cards-heading"
          className="mt-2 max-w-3xl text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-[var(--text-primary)] sm:text-4xl"
        >
          Every claim on this page is backed by an artifact.
        </h2>

        <ul className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-4">
          {TILES.map((tile) => (
            <li
              key={tile.key}
              data-card={tile.key}
              className="flex flex-1 flex-col items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--elevation-card)] lg:items-center lg:text-center"
            >
              <img
                src={tile.icon}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{tile.title}</h3>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">{tile.body}</p>
              {tile.link.external ? (
                <a
                  href={tile.link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-auto text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
                >
                  {tile.link.label}
                </a>
              ) : (
                <Link
                  href={tile.link.href}
                  className="mt-auto text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
                >
                  {tile.link.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
