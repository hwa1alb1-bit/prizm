import 'server-only'

import type { BillingPlan, SubscriptionStatus } from '@/lib/shared/billing'
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
}

export type BillingGateResult =
  | {
      allowed: true
      mode: 'included_credit' | 'metered_overage'
    }
  | {
      allowed: false
      reason: 'payment_required' | 'credits_exhausted' | 'overage_not_configured'
      problemCode: string
      title: string
      detail: string
    }

const PLAN_ALLOWANCES: Record<BillingPlan, PlanAllowance> = {
  free: {
    plan: 'free',
    monthlyCredits: 5,
    overageAllowed: false,
  },
  starter: {
    plan: 'starter',
    monthlyCredits: 200,
    overageAllowed: true,
  },
  pro: {
    plan: 'pro',
    monthlyCredits: 1000,
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
