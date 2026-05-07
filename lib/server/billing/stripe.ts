import 'server-only'

import { recordAuditEventOrThrow } from '@/lib/server/audit'
import { getServiceRoleClient } from '@/lib/server/supabase'
import { getStripeClient } from '@/lib/server/stripe'
import { publicEnv, serverEnv } from '@/lib/shared/env'
import type { BillingPlan } from './plan'

export type PaidBillingPlan = Exclude<BillingPlan, 'free'>
export type BillingCycle = 'monthly' | 'annual'

export type CreateCheckoutSessionInput = {
  workspaceId: string
  userId: string
  customerEmail: string | null
  plan: PaidBillingPlan
  billingCycle: BillingCycle
}

export type CreatePortalSessionInput = {
  workspaceId: string
  userId: string
}

type SubscriptionCustomerRow = {
  stripe_customer_id: string
}

export class BillingStripeError extends Error {
  constructor(
    public readonly code: 'price_missing' | 'customer_missing' | 'session_missing',
    message = code,
  ) {
    super(message)
    this.name = 'BillingStripeError'
  }
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<{ url: string }> {
  const price = getCheckoutPriceId(input.plan, input.billingCycle)
  const customer = await ensureStripeCustomer(input)
  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/app/billing?checkout=success`,
    cancel_url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/app/billing?checkout=cancelled`,
    client_reference_id: input.workspaceId,
    metadata: {
      workspace_id: input.workspaceId,
      user_id: input.userId,
      plan: input.plan,
      billing_cycle: input.billingCycle,
    },
    subscription_data: {
      metadata: {
        workspace_id: input.workspaceId,
        plan: input.plan,
        billing_cycle: input.billingCycle,
      },
    },
  })

  if (!session.url) throw new BillingStripeError('session_missing')

  await recordAuditEventOrThrow({
    eventType: 'billing.checkout_session_created',
    workspaceId: input.workspaceId,
    actorUserId: input.userId,
    targetType: 'stripe_checkout_session',
    targetId: null,
    metadata: {
      stripe_session_id: session.id,
      plan: input.plan,
      billing_cycle: input.billingCycle,
    },
  })

  return { url: session.url }
}

export async function createCustomerPortalSession(
  input: CreatePortalSessionInput,
): Promise<{ url: string }> {
  const customer = await getWorkspaceStripeCustomer(input.workspaceId)
  if (!customer) throw new BillingStripeError('customer_missing')

  const session = await getStripeClient().billingPortal.sessions.create({
    customer,
    return_url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/app/billing`,
  })

  if (!session.url) throw new BillingStripeError('session_missing')

  await recordAuditEventOrThrow({
    eventType: 'billing.customer_portal_session_created',
    workspaceId: input.workspaceId,
    actorUserId: input.userId,
    targetType: 'stripe_customer',
    targetId: null,
    metadata: {
      stripe_customer_id: customer,
    },
  })

  return { url: session.url }
}

export function getCheckoutPriceId(plan: PaidBillingPlan, billingCycle: BillingCycle): string {
  const price =
    plan === 'starter'
      ? billingCycle === 'annual'
        ? serverEnv.STRIPE_PRICE_STARTER_ANNUAL
        : serverEnv.STRIPE_PRICE_STARTER_MONTHLY
      : billingCycle === 'annual'
        ? serverEnv.STRIPE_PRICE_PRO_ANNUAL
        : serverEnv.STRIPE_PRICE_PRO_MONTHLY

  if (!price) throw new BillingStripeError('price_missing')
  return price
}

async function ensureStripeCustomer(input: CreateCheckoutSessionInput): Promise<string> {
  const existing = await getWorkspaceStripeCustomer(input.workspaceId)
  if (existing) return existing

  const customer = await getStripeClient().customers.create({
    email: input.customerEmail ?? undefined,
    metadata: {
      workspace_id: input.workspaceId,
    },
  })

  const client = getServiceRoleClient()
  const { error } = await client.from('subscription').upsert(
    {
      workspace_id: input.workspaceId,
      stripe_customer_id: customer.id,
      plan: 'free',
      status: 'incomplete',
    },
    { onConflict: 'workspace_id' },
  )

  if (error) throw new Error(error.message)
  return customer.id
}

async function getWorkspaceStripeCustomer(workspaceId: string): Promise<string | null> {
  const client = getServiceRoleClient()
  const { data, error } = await client
    .from('subscription')
    .select('stripe_customer_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle<SubscriptionCustomerRow>()

  if (error) throw new Error(error.message)
  return data?.stripe_customer_id ?? null
}
