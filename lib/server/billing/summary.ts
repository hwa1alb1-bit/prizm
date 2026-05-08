import 'server-only'

import type { BillingPlan, BillingSummary, SubscriptionStatus } from '@/lib/shared/billing'
import { serverEnv } from '@/lib/shared/env'
import { getServiceRoleClient } from '@/lib/server/supabase'
import { getPlanAllowance } from './plan'

type BillingSummaryInput = {
  userId: string
}

type BillingSummaryClient = {
  from: (table: 'user_profile' | 'subscription' | 'credit_ledger') => {
    select: (columns: string) => {
      eq: (
        column: 'id' | 'workspace_id',
        value: string,
      ) => {
        single?: () => Promise<{
          data: { workspace_id: string } | null
          error: { message: string } | null
        }>
        maybeSingle?: () => Promise<{
          data: SubscriptionRow | null
          error: { message: string } | null
        }>
        order?: (
          column: 'created_at',
          options: { ascending: boolean },
        ) => {
          limit: (count: 1) => {
            maybeSingle: () => Promise<{
              data: { balance_after: number } | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
  }
}

type SubscriptionRow = {
  plan: string
  status: string
  billing_cycle: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  stripe_customer_id: string | null
}

export async function getBillingSummaryForUser(
  input: BillingSummaryInput,
): Promise<BillingSummary> {
  const client = getServiceRoleClient() as unknown as BillingSummaryClient
  const profile = await client
    .from('user_profile')
    .select('workspace_id')
    .eq('id', input.userId)
    .single?.()

  if (!profile || profile.error || !profile.data) {
    throw new Error('billing_workspace_not_found')
  }

  const workspaceId = profile.data.workspace_id
  const subscription = await client
    .from('subscription')
    .select(
      'plan, status, billing_cycle, current_period_end, cancel_at_period_end, stripe_customer_id',
    )
    .eq('workspace_id', workspaceId)
    .maybeSingle?.()

  if (subscription?.error) throw new Error('billing_subscription_read_failed')

  const latestCredit = await client
    .from('credit_ledger')
    .select('balance_after')
    .eq('workspace_id', workspaceId)
    .order?.('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestCredit?.error) throw new Error('billing_credit_read_failed')

  return buildBillingSummary(subscription?.data ?? null, latestCredit?.data?.balance_after ?? null)
}

export function buildBillingSummary(
  subscription: SubscriptionRow | null,
  latestCreditBalance: number | null,
): BillingSummary {
  const plan = normalizePlan(subscription?.plan)
  const allowance = getPlanAllowance(plan)
  const creditBalance = latestCreditBalance ?? allowance.monthlyCredits
  const usedCredits = Math.max(0, allowance.monthlyCredits - creditBalance)

  return {
    plan,
    status: normalizeStatus(subscription?.status),
    billingCycle:
      subscription?.billing_cycle === 'annual' || subscription?.billing_cycle === 'monthly'
        ? subscription.billing_cycle
        : null,
    creditBalance,
    monthlyCredits: allowance.monthlyCredits,
    usedCredits,
    overageAllowed: allowance.overageAllowed,
    overageMeterConfigured: Boolean(
      serverEnv.STRIPE_METER_OVERAGE && serverEnv.STRIPE_PRICE_OVERAGE_PAGE,
    ),
    currentPeriodEnd: subscription?.current_period_end ?? null,
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
    hasStripeCustomer: Boolean(subscription?.stripe_customer_id),
  }
}

function normalizePlan(plan: string | null | undefined): BillingPlan {
  if (plan === 'starter' || plan === 'pro') return plan
  return 'free'
}

function normalizeStatus(status: string | null | undefined): SubscriptionStatus {
  if (
    status === 'trialing' ||
    status === 'active' ||
    status === 'past_due' ||
    status === 'canceled' ||
    status === 'incomplete'
  ) {
    return status
  }
  return 'active'
}
