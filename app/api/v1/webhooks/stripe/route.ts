import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { recordAuditEventOrThrow } from '@/lib/server/audit'
import {
  createRouteContext,
  jsonResponse,
  problemResponse,
  type RouteContext,
} from '@/lib/server/http'
import { getServiceRoleClient } from '@/lib/server/supabase'
import { getStripeClient } from '@/lib/server/stripe'
import { serverEnv } from '@/lib/shared/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<Response> {
  const context = createRouteContext(req)
  const secret = serverEnv.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_STRIPE_WEBHOOK_CONFIG',
      title: 'Stripe webhook is not configured',
      detail: 'Stripe webhook verification is unavailable.',
    })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_AUTH_STRIPE_SIGNATURE_MISSING',
      title: 'Missing Stripe signature',
      detail: 'Stripe webhook requests must include a stripe-signature header.',
    })
  }

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = getStripeClient().webhooks.constructEvent(body, signature, secret)
  } catch {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_AUTH_STRIPE_SIGNATURE_INVALID',
      title: 'Invalid Stripe signature',
      detail: 'The webhook signature could not be verified.',
    })
  }

  try {
    await handleStripeEvent(event, context)
  } catch {
    return problemResponse(context, {
      status: 500,
      code: 'PRZM_INTERNAL_STRIPE_WEBHOOK_FAILED',
      title: 'Stripe webhook handling failed',
      detail: 'The webhook could not be processed.',
    })
  }

  return jsonResponse(context, {
    received: true,
    request_id: context.requestId,
    trace_id: context.traceId,
  })
}

async function handleStripeEvent(event: Stripe.Event, context: RouteContext): Promise<void> {
  await recordAuditEventOrThrow({
    eventType: `stripe.${event.type}`,
    targetType: 'stripe_event',
    metadata: {
      stripe_event_id: event.id,
      livemode: event.livemode,
      type: event.type,
      request_id: context.requestId,
      trace_id: context.traceId,
    },
  })

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(event.data.object)
      break
    default:
      break
  }
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
