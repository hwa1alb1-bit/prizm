import Link from 'next/link'

const FOOTER_LINKS = [
  { label: 'API Docs', href: '/docs/errors' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Contact', href: 'mailto:support@pdftoexcelstatementconverter.com' },
] as const

const OBSERVATORY_URL = 'https://observatory.mozilla.org/analyze/pdftoexcelstatementconverter.com'

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer role="contentinfo" className="border-t border-[var(--border-subtle)] bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-6 py-6 text-sm text-foreground/65 lg:px-8">
        <div className="flex w-full flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p>{`© ${year} StatementStudio. All rights reserved.`}</p>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-sm transition hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
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
    </footer>
  )
}
