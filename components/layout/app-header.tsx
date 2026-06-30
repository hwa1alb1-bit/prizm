import Link from 'next/link'

type CreditsChipState = {
  used: number
  included: number
  window?: 'monthly' | 'daily'
}

type AppHeaderProps = {
  authed: boolean
  accountHref?: string
  displayName?: string
  credits?: CreditsChipState
}

function CreditsChip({ used, included, window }: CreditsChipState) {
  const safeIncluded = Math.max(0, included)
  const safeUsed = Math.max(0, Math.min(used, safeIncluded))
  const isDaily = window === 'daily'
  const suffix = isDaily ? 'today' : 'Pages'
  const label = isDaily
    ? `${safeUsed} of ${safeIncluded} pages used today`
    : `${safeUsed} of ${safeIncluded} pages used this period`
  return (
    <span
      aria-label={label}
      className="hidden h-10 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm sm:inline-flex"
    >
      <span className="font-semibold tabular-nums text-[var(--text-primary)]">{safeUsed}</span>
      <span className="tabular-nums text-foreground/55">{`/${safeIncluded}`}</span>
      <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/55">
        {suffix}
      </span>
    </span>
  )
}

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marketing/logos/statementstudio-mark.png"
        alt=""
        aria-hidden="true"
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

export function AppHeader({ authed, accountHref = '/app/account', credits }: AppHeaderProps) {
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
          {authed && credits ? (
            <CreditsChip used={credits.used} included={credits.included} window={credits.window} />
          ) : null}
          {authed ? (
            <Link
              href={accountHref}
              className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-subtle)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Account
            </Link>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </header>
  )
}
