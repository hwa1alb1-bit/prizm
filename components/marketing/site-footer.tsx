import Link from 'next/link'

type FooterLink = { label: string; href: string; external?: boolean }
type FooterColumn = { heading: string; links: ReadonlyArray<FooterLink> }

const COLUMNS: ReadonlyArray<FooterColumn> = [
  {
    heading: 'Product',
    links: [
      { label: 'Convert a statement', href: '/' },
      { label: 'Supported issuers', href: '/issuers' },
      { label: 'Sample output', href: '/sample-output' },
      { label: 'Bank statement converter', href: '/bank-statement-converter' },
    ],
  },
  {
    heading: 'Trust',
    links: [
      { label: 'How we verify', href: '/how-we-verify' },
      { label: 'Throughput', href: '/throughput' },
      { label: 'Security', href: '/security' },
      { label: 'Status', href: '/status' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Conversion FAQ', href: '/faq/bank-statement-conversion' },
      { label: 'API Docs', href: '/docs/errors' },
      { label: 'Rate limits', href: '/docs/rate-limits' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Contact', href: 'mailto:support@pdftoexcelstatementconverter.com', external: true },
    ],
  },
]

const OBSERVATORY_URL = 'https://observatory.mozilla.org/analyze/pdftoexcelstatementconverter.com'

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer role="contentinfo" className="border-t border-[var(--border-subtle)] bg-background">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLUMNS.map((column) => (
            <nav
              key={column.heading}
              aria-label={column.heading}
              className="flex flex-col gap-3 text-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                {column.heading}
              </p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        className="rounded-sm text-foreground/75 transition hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="rounded-sm text-foreground/75 transition hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[var(--border-subtle)] pt-6 text-sm text-foreground/65 sm:flex-row sm:items-center">
          <p>{`© ${year} StatementStudio. All rights reserved.`}</p>
          <a
            href={OBSERVATORY_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="View Mozilla Observatory security report for pdftoexcelstatementconverter.com"
          >
            <span aria-hidden className="font-mono text-sm text-[var(--primary)]">
              A+
            </span>
            <span>Mozilla Observatory</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
