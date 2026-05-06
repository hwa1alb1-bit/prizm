import type { NextRequest } from 'next/server'
import { BillingStripeError, createCustomerPortalSession } from '@/lib/server/billing/stripe'
import { createRouteContext, jsonResponse, problemResponse } from '@/lib/server/http'
import { requireOwnerOrAdminUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<Response> {
  const context = createRouteContext(request)
  const auth = await requireOwnerOrAdminUser()
  if (!auth.ok) return problemResponse(context, auth.problem)

  try {
    const session = await createCustomerPortalSession({
      workspaceId: auth.context.profile.workspace_id,
      userId: auth.context.user.id,
    })

    return jsonResponse(
      context,
      {
        url: session.url,
        request_id: context.requestId,
        trace_id: context.traceId,
      },
      { status: 201 },
    )
  } catch (err) {
    return problemResponse(context, problemForPortalError(err))
  }
}

function problemForPortalError(err: unknown) {
  if (err instanceof BillingStripeError && err.code === 'customer_missing') {
    return {
      status: 409,
      code: 'PRZM_BILLING_CUSTOMER_MISSING',
      title: 'No billing customer',
      detail: 'Start a paid plan before opening the billing portal.',
    }
  }

  return {
    status: 500,
    code: 'PRZM_INTERNAL_BILLING_PORTAL_FAILED',
    title: 'Billing portal could not be opened',
    detail: 'A billing portal session could not be created. Try again later.',
  }
}
