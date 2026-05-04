import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { recordAuditEvent } from '@/lib/server/audit'
import { getServiceRoleClient } from '@/lib/server/supabase'
import { getStripeClient } from '@/lib/server/stripe'
import { serverEnv } from '@/lib/shared/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<Response> {
  const secret = serverEnv.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return Response.json({ error: 'STRIPE_WEBHOOK_SECRET not configured' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return Response.json({ error: 'Missing Stripe signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = getStripeClient().webhooks.constructEvent(body, signature, secret)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Invalid Stripe webhook' },
      { status: 400 },
    )
  }

  try {
    await handleStripeEvent(event)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Stripe webhook handling failed' },
      { status: 500 },
    )
  }

  return Response.json({ received: true })
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(event.data.object)
      break
    default:
      break
  }

  await recordAuditEvent({
    eventType: `stripe.${event.type}`,
    targetType: 'stripe_event',
    metadata: {
      stripe_event_id: event.id,
      livemode: event.livemode,
      type: event.type,
    },
  })
}

async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const client = getServiceRoleClient()
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  const item = subscription.items.data[0]
  const price = item?.price
  const patch = {
    stripe_subscription_id: subscription.id,
    plan: planFromPrice(price?.id),
    billing_cycle: price?.recurring?.interval === 'year' ? 'annual' : 'monthly',
    status: subscription.status,
    current_period_start: timestampToIso(item?.current_period_start),
    current_period_end: timestampToIso(item?.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
  }

  const bySubscription = await client
    .from('subscription')
    .update(patch)
    .eq('stripe_subscription_id', subscription.id)
    .select('id')
    .maybeSingle()

  if (bySubscription.error) throw new Error(bySubscription.error.message)
  if (bySubscription.data) return

  const byCustomer = await client
    .from('subscription')
    .update(patch)
    .eq('stripe_customer_id', customerId)
    .select('id')
    .maybeSingle()

  if (byCustomer.error) throw new Error(byCustomer.error.message)
}

function planFromPrice(priceId: string | undefined): 'free' | 'starter' | 'pro' {
  if (!priceId) return 'free'
  if (
    priceId === serverEnv.STRIPE_PRICE_STARTER_MONTHLY ||
    priceId === serverEnv.STRIPE_PRICE_STARTER_ANNUAL
  ) {
    return 'starter'
  }
  if (
    priceId === serverEnv.STRIPE_PRICE_PRO_MONTHLY ||
    priceId === serverEnv.STRIPE_PRICE_PRO_ANNUAL
  ) {
    return 'pro'
  }
  return 'free'
}

function timestampToIso(timestamp: number | null | undefined): string | null {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null
}
