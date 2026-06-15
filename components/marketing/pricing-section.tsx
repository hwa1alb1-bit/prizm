'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PLAN_MONTHLY_CREDITS } from '@/lib/shared/plan-allowances'

type PricingSectionProps = {
  isAuthenticated: boolean
}

const PAGES = {
  free: PLAN_MONTHLY_CREDITS.free.toLocaleString('en-US'),
  starter: PLAN_MONTHLY_CREDITS.starter.toLocaleString('en-US'),
  pro: PLAN_MONTHLY_CREDITS.pro.toLocaleString('en-US'),
} as const

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
    features: [`${PAGES.free} pages per month`, 'No overage, no credit card required'],
    ctaLabel: 'Get started',
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '$19',
    cadence: '/ mo',
    blurb: 'Great for regular use',
    features: [
      `${PAGES.starter} pages per month`,
      'Priority extraction queue',
      'Overage billing for additional pages',
      'Email support',
    ],
    ctaLabel: 'Subscribe',
    popular: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$49',
    cadence: '/ mo',
    blurb: 'For teams and high volume',
    features: [
      `${PAGES.pro} pages per month`,
      'Overage billing for additional pages',
      'Priority support',
    ],
    ctaLabel: 'Subscribe',
  },
]

function CheckBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12l4.5 4.5L19 7" />
      </svg>
      <span className="text-[var(--text-secondary)]">{children}</span>
    </li>
  )
}

export function PricingSection({ isAuthenticated }: PricingSectionProps) {
  const [error, setError] = useState<string | null>(null)
  const [busyPlan, setBusyPlan] = useState<'starter' | 'pro' | null>(null)

  async function startCheckout(plan: 'starter' | 'pro') {
    setError(null)
    setBusyPlan(plan)
    try {
      const response = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle: 'monthly' }),
      })
      if (!response.ok) {
        const problem = (await response.json().catch(() => ({}))) as {
          detail?: string
          title?: string
        }
        throw new Error(problem.detail ?? problem.title ?? 'Checkout could not be started.')
      }
      const body = (await response.json().catch(() => ({}))) as { url?: string }
      if (!body.url) throw new Error('Checkout could not be started.')
      window.location.assign(body.url)
    } catch (err) {
      setBusyPlan(null)
      setError(err instanceof Error ? err.message : 'Checkout could not be started.')
    }
  }

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="scroll-mt-24 border-t border-[var(--border)] bg-[var(--surface-soft)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              Pricing
            </p>
            <h2
              id="pricing-heading"
              className="mt-2 text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-[var(--text-primary)] sm:text-4xl"
            >
              Simple pricing. No surprises.
            </h2>
            <p className="mt-3 max-w-xl text-base text-[var(--text-secondary)]">
              Start free. Move up when you need more pages.
            </p>
          </div>
        </div>

        <ul className="mt-10 grid gap-5 lg:grid-cols-3">
          {TIERS.map((tier) => {
            const isPopular = Boolean(tier.popular)
            return (
              <li key={tier.key} className="relative flex">
                <article
                  data-tile-root="pricing"
                  className={`relative flex w-full flex-col gap-4 rounded-xl border bg-[var(--surface)] p-6 shadow-[var(--elevation-card)] ${
                    isPopular
                      ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]'
                      : 'border-[var(--border)]'
                  }`}
                >
                  {isPopular ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--primary)] px-3 py-1 text-xs font-semibold text-white shadow-[var(--elevation-card)]">
                      Most popular
                    </span>
                  ) : null}
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">
                      {tier.name}
                    </h3>
                    <p className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                        {tier.price}
                      </span>
                      <span className="text-sm text-[var(--text-muted)]">{tier.cadence}</span>
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{tier.blurb}</p>
                  </div>
                  <ul className="space-y-2">
                    {tier.features.map((f) => (
                      <CheckBullet key={f}>{f}</CheckBullet>
                    ))}
                  </ul>
                  <TierCta
                    tier={tier}
                    isAuthenticated={isAuthenticated}
                    isPopular={isPopular}
                    busyPlan={busyPlan}
                    onCheckout={startCheckout}
                  />
                </article>
              </li>
            )
          })}
        </ul>

        {error ? (
          <p className="mt-4 text-center text-sm font-medium text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function TierCta({
  tier,
  isAuthenticated,
  isPopular,
  busyPlan,
  onCheckout,
}: {
  tier: Tier
  isAuthenticated: boolean
  isPopular: boolean
  busyPlan: 'starter' | 'pro' | null
  onCheckout: (plan: 'starter' | 'pro') => void
}) {
  const ctaClass = `mt-auto inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] active:translate-y-px ${
    isPopular
      ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
      : 'border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]'
  }`

  if (tier.key === 'free') {
    return (
      <Link href="/register" className={ctaClass}>
        {tier.ctaLabel}
      </Link>
    )
  }

  if (!isAuthenticated) {
    return (
      <Link href="/register?next=/app/account" className={ctaClass}>
        {tier.ctaLabel}
      </Link>
    )
  }

  const plan = tier.key
  const busy = busyPlan === plan
  return (
    <button
      type="button"
      onClick={() => onCheckout(plan)}
      disabled={busyPlan !== null}
      className={`${ctaClass} disabled:opacity-60`}
    >
      {busy ? 'Starting checkout...' : tier.ctaLabel}
    </button>
  )
}
