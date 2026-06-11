import Link from 'next/link'

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marketing/logos/statementstudio-mark.png"
        alt=""
        width={72}
        height={72}
        className="h-[72px] w-[72px] object-contain mix-blend-multiply"
      />
      <span className="inline-flex flex-col leading-none">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
          PDF to spreadsheet
        </span>
        <span className="mt-1.5 text-[28px] font-extrabold tracking-[-0.025em] text-[var(--text-primary)]">
          Statement<span className="text-[var(--primary)]">Studio</span>
        </span>
      </span>
    </span>
  )
}

export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-background/90 backdrop-blur"
      role="banner"
    >
      <div className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-4 px-6 lg:px-8">
        <Link
          href="/"
          aria-label="StatementStudio home"
          className="rounded-md text-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Wordmark />
        </Link>

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
