import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { processStripeWebhookEvent } from '@/lib/server/billing/webhook-events'

const routeContext = {
  requestId: 'req_stripe',
  traceId: '0123456789abcdef0123456789abcdef',
  pathname: '/api/v1/webhooks/stripe',
}

describe('processStripeWebhookEvent', () => {
  it('does not process a replayed Stripe event after the ledger has already claimed it', async () => {
    const deps = {
      claimStripeWebhookEvent: vi.fn().mockResolvedValue({ claimed: false }),
      recordStripeAuditEvent: vi.fn(),
      retrieveStripeSubscription: vi.fn(),
      syncStripeSubscription: vi.fn(),
      grantSubscriptionCredits: vi.fn(),
      markStripeWebhookEventProcessed: vi.fn(),
      markStripeWebhookEventFailed: vi.fn(),
    }

    const result = await processStripeWebhookEvent(
      stripeEvent('customer.subscription.updated'),
      routeContext,
      deps,
    )

    expect(result).toEqual({ processed: false, replayed: true })
    expect(deps.recordStripeAuditEvent).not.toHaveBeenCalled()
    expect(deps.retrieveStripeSubscription).not.toHaveBeenCalled()
  })

  it('retrieves current Stripe subscription state before syncing and granting credits', async () => {
    const subscription = stripeSubscription({
      id: 'sub_123',
      customer: 'cus_123',
      price: 'price_starter_monthly',
    })
    const deps = {
      claimStripeWebhookEvent: vi.fn().mockResolvedValue({ claimed: true }),
      recordStripeAuditEvent: vi.fn().mockResolvedValue('audit_123'),
      retrieveStripeSubscription: vi.fn().mockResolvedValue(subscription),
      syncStripeSubscription: vi.fn().mockResolvedValue({
        workspaceId: 'workspace_123',
        plan: 'starter',
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
      }),
      grantSubscriptionCredits: vi.fn().mockResolvedValue(undefined),
      markStripeWebhookEventProcessed: vi.fn().mockResolvedValue(undefined),
      markStripeWebhookEventFailed: vi.fn(),
    }

    const result = await processStripeWebhookEvent(
      stripeEvent('customer.subscription.updated'),
      routeContext,
      deps,
    )

    expect(result).toEqual({ processed: true, replayed: false })
    expect(deps.retrieveStripeSubscription).toHaveBeenCalledWith('sub_123')
    expect(deps.syncStripeSubscription).toHaveBeenCalledWith(subscription)
    expect(deps.grantSubscriptionCredits).toHaveBeenCalledWith({
      workspaceId: 'workspace_123',
      plan: 'starter',
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-06-01T00:00:00.000Z',
    })
    expect(deps.markStripeWebhookEventProcessed).toHaveBeenCalledWith('evt_123')
  })
})

function stripeEvent(type: Stripe.Event.Type): Stripe.Event {
  return {
    id: 'evt_123',
    type,
    livemode: false,
    data: { object: { id: 'sub_123', object: 'subscription' } },
  } as Stripe.Event
}

function stripeSubscription(input: {
  id: string
  customer: string
  price: string
}): Stripe.Subscription {
  return {
    id: input.id,
    customer: input.customer,
    status: 'active',
    cancel_at_period_end: false,
    metadata: { workspace_id: 'workspace_123' },
    items: {
      data: [
        {
          price: {
            id: input.price,
            recurring: { interval: 'month' },
          },
          current_period_start: 1777593600,
          current_period_end: 1780272000,
        },
      ],
    },
  } as unknown as Stripe.Subscription
}
