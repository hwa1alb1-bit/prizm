import 'server-only'

import type { BillingPlan, SubscriptionStatus } from '@/lib/shared/billing'
import { PLAN_MONTHLY_CREDITS } from '@/lib/shared/plan-allowances'
import { FREE_DAILY_PAGE_LIMIT } from './daily-usage'
export type { BillingPlan, SubscriptionStatus }

export type PlanAllowance = {
  plan: BillingPlan
  monthlyCredits: number
  overageAllowed: boolean
}

export type BillingGateInput = {
  plan: BillingPlan
  status: SubscriptionStatus
  creditBalance: number
  overageMeterConfigured: boolean
  dailyPagesUsed?: number
  requestedPages?: number
}

export type BillingGateResult =
  | {
      allowed: true
      mode: 'included_credit' | 'metered_overage'
    }
  | {
      allowed: false
      reason:
        | 'payment_required'
        | 'credits_exhausted'
        | 'overage_not_configured'
        | 'daily_limit_reached'
      problemCode: string
      title: string
      detail: string
    }

export const PLAN_ALLOWANCES: Record<BillingPlan, PlanAllowance> = {
  free: {
    plan: 'free',
    monthlyCredits: PLAN_MONTHLY_CREDITS.free,
    overageAllowed: false,
  },
  starter: {
    plan: 'starter',
    monthlyCredits: PLAN_MONTHLY_CREDITS.starter,
    overageAllowed: true,
  },
  pro: {
    plan: 'pro',
    monthlyCredits: PLAN_MONTHLY_CREDITS.pro,
    overageAllowed: true,
  },
}

const PAYMENT_BLOCKED_STATUSES = new Set<SubscriptionStatus>(['past_due', 'canceled', 'incomplete'])

export function getPlanAllowance(plan: BillingPlan): PlanAllowance {
  return PLAN_ALLOWANCES[plan]
}

export function evaluateBillingGate(input: BillingGateInput): BillingGateResult {
  const allowance = getPlanAllowance(input.plan)

  if (PAYMENT_BLOCKED_STATUSES.has(input.status) && input.plan !== 'free') {
    return {
      allowed: false,
      reason: 'payment_required',
      problemCode: 'PRZM_BILLING_PAYMENT_REQUIRED',
      title: 'Payment required',
      detail: 'Resolve the workspace billing status before starting paid conversions.',
    }
  }

  if (input.plan === 'free' && typeof input.dailyPagesUsed === 'number') {
    const requested = input.requestedPages ?? 1
    if (input.dailyPagesUsed + requested <= FREE_DAILY_PAGE_LIMIT) {
      return { allowed: true, mode: 'included_credit' }
    }
    return {
      allowed: false,
      reason: 'daily_limit_reached',
      problemCode: 'PRZM_BILLING_DAILY_LIMIT_REACHED',
      title: 'Daily upload limit reached',
      detail: `Free plan allows ${FREE_DAILY_PAGE_LIMIT} pages per day. Try again tomorrow or upgrade.`,
    }
  }

  if (input.creditBalance > 0) {
    return { allowed: true, mode: 'included_credit' }
  }

  if (!allowance.overageAllowed) {
    return {
      allowed: false,
      reason: 'credits_exhausted',
      problemCode: 'PRZM_BILLING_CREDITS_EXHAUSTED',
      title: 'Conversion credits exhausted',
      detail: 'Upgrade or wait for the next billing period before starting another conversion.',
    }
  }

  if (!input.overageMeterConfigured) {
    return {
      allowed: false,
      reason: 'overage_not_configured',
      problemCode: 'PRZM_BILLING_OVERAGE_NOT_CONFIGURED',
      title: 'Overage billing is not configured',
      detail: 'This plan allows overage, but Stripe metering is not configured.',
    }
  }

  return { allowed: true, mode: 'metered_overage' }
}
