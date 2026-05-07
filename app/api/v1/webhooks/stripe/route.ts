import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { processStripeWebhookEvent } from '@/lib/server/billing/webhook-events'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'
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
    await processStripeWebhookEvent(event, context)
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
