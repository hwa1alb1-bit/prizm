import Link from 'next/link'

const FOOTER_LINKS = [
  { label: 'API Docs', href: '/docs/errors' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Contact', href: 'mailto:support@pdftoexcelstatementconverter.com' },
] as const

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer role="contentinfo" className="border-t border-[var(--border-subtle)] bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-6 py-6 text-sm text-foreground/65 sm:flex-row sm:items-center lg:px-8">
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
    </footer>
  )
}
