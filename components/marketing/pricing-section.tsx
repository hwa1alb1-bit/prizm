import Link from 'next/link'

type PricingSectionProps = {
  isAuthenticated: boolean
}

type Tier = {
  key: 'free' | 'starter' | 'pro'
  name: string
  price: string
  cadence: string
  blurb: string
  features: string[]
  ctaLabel: string
  popular?: boolean
}

const TIERS: Tier[] = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    cadence: 'after email signup',
    blurb: 'Perfect for trying out',
    features: ['1 conversion every 24 hours', 'XLSX, CSV, QuickBooks CSV, Xero CSV'],
    ctaLabel: 'Get started',
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '$19',
    cadence: '/ mo',
    blurb: 'Great for regular use',
    features: ['Monthly conversion credits', 'Priority extraction queue', 'Email support'],
    ctaLabel: 'Subscribe',
    popular: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$49',
    cadence: '/ mo',
    blurb: 'For teams and high volume',
    features: ['Higher monthly credits', 'Overage billing per page', 'Priority support'],
    ctaLabel: 'Subscribe',
  },
]

function resolveHref(tier: Tier, isAuthenticated: boolean): string {
  if (tier.key === 'free') return '/register'
  return isAuthenticated ? '/app/billing' : '/register?next=/app/billing'
}

function CheckBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12l4.5 4.5L19 7" />
      </svg>
      <span className="text-foreground/75">{children}</span>
    </li>
  )
}

export function PricingSection({ isAuthenticated }: PricingSectionProps) {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="pricing-heading" className="text-2xl font-semibold tracking-tight">
              Simple pricing. No surprises.
            </h2>
            <p className="mt-2 text-sm text-foreground/65">
              Start for free. Upgrade anytime for more conversions.
            </p>
          </div>
        </div>

        <ul className="mt-10 grid gap-5 lg:grid-cols-3">
          {TIERS.map((tier) => {
            const href = resolveHref(tier, isAuthenticated)
            const isPopular = Boolean(tier.popular)
            return (
              <li key={tier.key} className="relative flex">
                <article
                  data-tile-root="pricing"
                  className={`relative flex w-full flex-col gap-4 rounded-xl border p-6 ${
                    isPopular
                      ? 'border-[var(--accent)] bg-background shadow-sm'
                      : 'border-[var(--border-subtle)] bg-background'
                  }`}
                >
                  {isPopular ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent-foreground)]">
                      Most popular
                    </span>
                  ) : null}
                  <div>
                    <h3 className="text-base font-semibold">{tier.name}</h3>
                    <p className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tracking-tight">{tier.price}</span>
                      <span className="text-sm text-foreground/55">{tier.cadence}</span>
                    </p>
                    <p className="mt-1 text-sm text-foreground/65">{tier.blurb}</p>
                  </div>
                  <ul className="space-y-2">
                    {tier.features.map((f) => (
                      <CheckBullet key={f}>{f}</CheckBullet>
                    ))}
                  </ul>
                  <Link
                    href={href}
                    className={`mt-auto inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      isPopular
                        ? 'bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 active:translate-y-px'
                        : 'border border-[var(--border-subtle)] text-foreground hover:bg-[var(--surface-muted)] active:translate-y-px'
                    }`}
                  >
                    {tier.ctaLabel}
                  </Link>
                </article>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
