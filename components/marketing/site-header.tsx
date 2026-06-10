import Link from 'next/link'

const NAV_ANCHORS = ['Pricing', 'Features', 'Security'] as const

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 3h7l4 4v14H7z" fill="color-mix(in oklch, var(--accent) 10%, transparent)" />
        <path d="M14 3v4h4" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </svg>
      <span className="text-lg font-semibold tracking-tight">StatementStudio</span>
    </span>
  )
}

export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-background/90 backdrop-blur"
      role="banner"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6 lg:px-8">
        <Link
          href="/"
          aria-label="StatementStudio home"
          className="rounded-md text-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Wordmark />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-6 text-sm font-medium text-foreground/80 md:flex"
        >
          {NAV_ANCHORS.map((label) => (
            <Link
              key={label}
              href={`#${label.toLowerCase()}`}
              className="rounded-sm transition hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] transition hover:opacity-90 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Register
          </Link>
        </div>
      </div>
    </header>
  )
}
