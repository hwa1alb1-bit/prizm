import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from '@/lib/shared/env'
import type { Database } from '@/lib/shared/db-types'
import { evaluateBillingGate, getPlanAllowance, type BillingPlan } from './plan'

type BillingAccessInput = {
  supabase: SupabaseClient<Database>
  userId: string
}

type BillingLookupClient = {
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
          data: {
            plan?: BillingPlan
            status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
            balance_after?: number
          } | null
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

export async function getUploadBillingGate(input: BillingAccessInput) {
  const client = input.supabase as unknown as BillingLookupClient
  const profile = await client
    .from('user_profile')
    .select('workspace_id')
    .eq('id', input.userId)
    .single?.()

  if (!profile || profile.error || !profile.data) {
    return {
      allowed: false,
      reason: 'payment_required' as const,
      problemCode: 'PRZM_BILLING_WORKSPACE_REQUIRED',
      title: 'Billing workspace required',
      detail: 'Workspace billing state could not be loaded.',
    }
  }

  const workspaceId = profile.data.workspace_id
  const subscription = await client
    .from('subscription')
    .select('plan, status')
    .eq('workspace_id', workspaceId)
    .maybeSingle?.()

  if (subscription?.error) {
    return {
      allowed: false,
      reason: 'payment_required' as const,
      problemCode: 'PRZM_BILLING_STATE_UNAVAILABLE',
      title: 'Billing state unavailable',
      detail: 'Workspace billing state could not be loaded.',
    }
  }

  const plan = subscription?.data?.plan ?? 'free'
  const status = subscription?.data?.status ?? 'active'
  const ledger = await client
    .from('credit_ledger')
    .select('balance_after')
    .eq('workspace_id', workspaceId)
    .order?.('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ledger?.error) {
    return {
      allowed: false,
      reason: 'payment_required' as const,
      problemCode: 'PRZM_BILLING_CREDITS_UNAVAILABLE',
      title: 'Conversion credits unavailable',
      detail: 'Workspace conversion credits could not be loaded.',
    }
  }

  const allowance = getPlanAllowance(plan)
  const creditBalance = ledger?.data?.balance_after ?? allowance.monthlyCredits

  return evaluateBillingGate({
    plan,
    status,
    creditBalance,
    overageMeterConfigured: Boolean(
      serverEnv.STRIPE_PRICE_OVERAGE_PAGE && serverEnv.STRIPE_METER_OVERAGE,
    ),
  })
}
