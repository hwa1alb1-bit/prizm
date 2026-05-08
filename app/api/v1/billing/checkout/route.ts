import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  BillingStripeError,
  createCheckoutSession,
  type BillingCycle,
  type PaidBillingPlan,
} from '@/lib/server/billing/stripe'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'
import { applyAuthenticatedRateLimit, withRateLimitHeaders } from '@/lib/server/route-rate-limit'
import { requireOwnerOrAdminUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const checkoutSchema = z.object({
  plan: z.enum(['starter', 'pro']),
  billingCycle: z.enum(['monthly', 'annual']).default('monthly'),
})

export async function POST(request: NextRequest): Promise<Response> {
  const context = createRouteContext(request)
  const auth = await requireOwnerOrAdminUser()
  if (!auth.ok) return problemResponse(context, auth.problem)

  const rateLimitDecision = await applyAuthenticatedRateLimit(
    context,
    'billing',
    auth.context.user.id,
  )
  if (!rateLimitDecision.ok) return rateLimitDecision.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_INVALID_JSON',
      title: 'Invalid JSON',
      detail: 'The request body must be valid JSON.',
    })
  }

  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return problemResponse(context, {
      status: 400,
      code: 'PRZM_VALIDATION_BILLING_CHECKOUT',
      title: 'Invalid Checkout request',
      detail: parsed.error.issues[0]?.message ?? 'Invalid input.',
    })
  }

  try {
    const session = await createCheckoutSession({
      workspaceId: auth.context.profile.workspace_id,
      userId: auth.context.user.id,
      customerEmail: auth.context.user.email ?? null,
      plan: parsed.data.plan as PaidBillingPlan,
      billingCycle: parsed.data.billingCycle as BillingCycle,
    })

    return withRateLimitHeaders(
      jsonResponse(
        context,
        {
          url: session.url,
          request_id: context.requestId,
          trace_id: context.traceId,
        },
        { status: 201 },
      ),
      rateLimitDecision.result,
    )
  } catch (err) {
    return problemResponse(context, problemForCheckoutError(err))
  }
}

function problemForCheckoutError(err: unknown) {
  if (err instanceof BillingStripeError && err.code === 'price_missing') {
    return {
      status: 500,
      code: 'PRZM_INTERNAL_BILLING_PRICE_MISSING',
      title: 'Billing price is not configured',
      detail: 'The selected plan is temporarily unavailable.',
    }
  }

  return {
    status: 500,
    code: 'PRZM_INTERNAL_BILLING_CHECKOUT_FAILED',
    title: 'Checkout could not be created',
    detail: 'A Checkout session could not be created. Try again later.',
  }
}
