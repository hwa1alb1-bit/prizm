import 'server-only'

import { Buffer } from 'node:buffer'
import { serverEnv } from '@/lib/shared/env'
import type { BillingPlan, BillingGateResult, SubscriptionStatus } from './plan'
import { evaluateBillingGate } from './plan'

export type ConversionBillingUsageInput = {
  plan: BillingPlan
  status: SubscriptionStatus
  pages: number
  creditBalance: number
  overageMeterConfigured: boolean
}

export type ConversionBillingUsageResult =
  | {
      allowed: true
      creditDebit: number
      overagePages: number
      balanceAfter: number
    }
  | Extract<BillingGateResult, { allowed: false }>

export type StripeOverageUsageInput = {
  stripeCustomerId: string
  documentId: string
  workspaceId: string
  pages: number
}

export function calculateConversionBillingUsage(
  input: ConversionBillingUsageInput,
): ConversionBillingUsageResult {
  const initialGate = evaluateBillingGate({
    plan: input.plan,
    status: input.status,
    creditBalance: input.creditBalance,
    overageMeterConfigured: input.overageMeterConfigured,
  })

  if (!initialGate.allowed) return initialGate

  const creditDebit = Math.min(input.pages, Math.max(0, input.creditBalance))
  const overagePages = input.pages - creditDebit

  if (overagePages > 0) {
    const overageGate = evaluateBillingGate({
      plan: input.plan,
      status: input.status,
      creditBalance: 0,
      overageMeterConfigured: input.overageMeterConfigured,
    })

    if (!overageGate.allowed) return overageGate
  }

  return {
    allowed: true,
    creditDebit,
    overagePages,
    balanceAfter: input.creditBalance - creditDebit,
  }
}

export async function reportStripeOverageUsage(input: StripeOverageUsageInput): Promise<void> {
  if (input.pages <= 0) return
  if (!serverEnv.STRIPE_SECRET_KEY || !serverEnv.STRIPE_METER_OVERAGE) {
    throw new Error('stripe_metering_not_configured')
  }

  const body = new URLSearchParams()
  body.set('event_name', 'prizm_page_processed')
  body.set('payload[stripe_customer_id]', input.stripeCustomerId)
  body.set('payload[value]', String(input.pages))
  body.set('identifier', `prizm:${input.workspaceId}:${input.documentId}:overage`)

  const response = await fetch('https://api.stripe.com/v1/billing/meter_events', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${serverEnv.STRIPE_SECRET_KEY}:`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    throw new Error('stripe_meter_event_failed')
  }
}
