'use client'

import { useState } from 'react'
import type { BillingPlan, BillingSummary, SubscriptionStatus } from '@/lib/shared/billing'

type BillingActionState = 'idle' | 'loading' | 'error'
type PaidPlan = 'starter' | 'pro'
type BillingCycle = 'monthly' | 'annual'

export function BillingDashboard({ summary }: { summary: BillingSummary }) {
  const [actionState, setActionState] = useState<BillingActionState>('idle')
  const usagePercent =
    summary.monthlyCredits > 0
      ? Math.min(100, Math.round((summary.usedCredits / summary.monthlyCredits) * 100))
      : 0

  async function startCheckout(plan: PaidPlan, billingCycle: BillingCycle) {
    setActionState('loading')
    try {
      const response = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle }),
      })
      const body = (await response.json().catch(() => ({}))) as { url?: string }
      if (!response.ok || !body.url) throw new Error('checkout_failed')
      setActionState('idle')
      window.location.assign(body.url)
    } catch {
      setActionState('error')
    }
  }

  async function openPortal() {
    setActionState('loading')
    try {
      const response = await fetch('/api/v1/billing/portal', { method: 'POST' })
      const body = (await response.json().catch(() => ({}))) as { url?: string }
      if (!response.ok || !body.url) throw new Error('portal_failed')
      setActionState('idle')
      window.location.assign(body.url)
    } catch {
      setActionState('error')
    }
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-foreground/10 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Plan access, conversion credits, invoices, and payment controls.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="rounded-lg border border-foreground/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                Current plan
              </p>
              <h2 className="mt-1 text-xl font-semibold">{planLabel(summary.plan)}</h2>
              <p className={`mt-2 text-sm font-medium ${statusClass(summary.status)}`}>
                {statusLabel(summary.status)}
              </p>
            </div>
            <div className="text-sm sm:text-right">
              <p className="font-medium">
                {summary.creditBalance} / {summary.monthlyCredits} credits
              </p>
              <p className="mt-1 text-foreground/55">{summary.usedCredits} used this period</p>
              <p className="mt-1 text-foreground/55">{renewalText(summary)}</p>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full bg-emerald-500" style={{ width: `${usagePercent}%` }} />
          </div>
          <div className="mt-3 grid gap-2 text-xs text-foreground/60 sm:grid-cols-2">
            <p>{usagePercent}% of included credits used</p>
            <p className="sm:text-right">{overageStatus(summary)}</p>
          </div>
        </div>

        <aside className="rounded-lg border border-foreground/10 p-4">
          <h2 className="text-sm font-semibold">Billing controls</h2>
          <p className="mt-2 text-xs leading-5 text-foreground/60">
            Invoices and receipts are managed in the Stripe portal.
          </p>
          <div className="mt-4 space-y-2">
            {summary.hasStripeCustomer && (
              <button
                type="button"
                onClick={() => void openPortal()}
                disabled={actionState === 'loading'}
                className="w-full rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
              >
                Open portal
              </button>
            )}
            <button
              type="button"
              onClick={() => void startCheckout('starter', 'monthly')}
              disabled={actionState === 'loading'}
              className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              Starter monthly
            </button>
            <button
              type="button"
              onClick={() => void startCheckout('starter', 'annual')}
              disabled={actionState === 'loading'}
              className="w-full rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
            >
              Starter annual
            </button>
            <button
              type="button"
              onClick={() => void startCheckout('pro', 'monthly')}
              disabled={actionState === 'loading'}
              className="w-full rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
            >
              Pro monthly
            </button>
            <button
              type="button"
              onClick={() => void startCheckout('pro', 'annual')}
              disabled={actionState === 'loading'}
              className="w-full rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
            >
              Pro annual
            </button>
            {actionState === 'error' && (
              <p className="text-xs text-red-600">Billing action failed. Try again.</p>
            )}
          </div>
        </aside>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <PlanSummary name="Free" credits="5 credits" price="$0" current={summary.plan === 'free'} />
        <PlanSummary
          name="Starter"
          credits="200 credits"
          price="$19 / month"
          current={summary.plan === 'starter'}
        />
        <PlanSummary
          name="Pro"
          credits="1,000 credits"
          price="$49 / month"
          current={summary.plan === 'pro'}
        />
      </section>
    </div>
  )
}

function overageStatus(summary: BillingSummary): string {
  if (!summary.overageAllowed) return 'Overage unavailable on this plan'
  return summary.overageMeterConfigured
    ? 'Overage metering configured'
    : 'Overage metering needs setup'
}

function PlanSummary({
  name,
  credits,
  price,
  current,
}: {
  name: string
  credits: string
  price: string
  current: boolean
}) {
  return (
    <article className="rounded-lg border border-foreground/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold">{name}</h2>
        {current && (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Current
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-foreground/60">{credits}</p>
      <p className="mt-1 text-sm font-medium">{price}</p>
    </article>
  )
}

function planLabel(plan: BillingPlan): string {
  switch (plan) {
    case 'free':
      return 'Free'
    case 'starter':
      return 'Starter'
    case 'pro':
      return 'Pro'
  }
}

function statusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'trialing':
      return 'Trialing'
    case 'past_due':
      return 'Payment past due'
    case 'canceled':
      return 'Canceled'
    case 'incomplete':
      return 'Payment incomplete'
  }
}

function statusClass(status: SubscriptionStatus): string {
  return status === 'active' || status === 'trialing'
    ? 'text-emerald-700 dark:text-emerald-300'
    : 'text-red-700 dark:text-red-300'
}

function renewalText(summary: BillingSummary): string {
  if (!summary.currentPeriodEnd) return 'No renewal scheduled'
  const date = summary.currentPeriodEnd.slice(0, 10)
  return summary.cancelAtPeriodEnd ? `Cancels ${date}` : `Renews ${date}`
}
