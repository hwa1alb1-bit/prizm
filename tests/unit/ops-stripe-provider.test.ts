import { describe, expect, it } from 'vitest'
import { buildStripeBillingMetrics } from '@/lib/server/ops/providers'

describe('buildStripeBillingMetrics', () => {
  it('turns webhook failures and blocked subscriptions into Stripe Ops metrics', () => {
    const metrics = buildStripeBillingMetrics({
      sourceUrl: 'https://dashboard.stripe.com',
      failedWebhookEvents: 2,
      blockedSubscriptions: 1,
      activeSubscriptions: 4,
    })

    expect(metrics).toEqual([
      expect.objectContaining({
        metricKey: 'webhook_failures_24h',
        displayName: 'Webhook failures, 24h',
        used: 2,
        limit: 1,
        unit: 'count',
        required: true,
        errorCode: 'stripe_webhook_failures',
      }),
      expect.objectContaining({
        metricKey: 'blocked_subscription_count',
        displayName: 'Blocked subscriptions',
        used: 1,
        limit: 1,
        unit: 'count',
        required: true,
        errorCode: 'stripe_billing_blocked',
      }),
      expect.objectContaining({
        metricKey: 'active_subscription_count',
        displayName: 'Active subscriptions',
        used: 4,
        limit: null,
        unit: 'count',
        required: false,
      }),
    ])
  })
})
