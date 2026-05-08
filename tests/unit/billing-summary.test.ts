import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildBillingSummary, getBillingSummaryForUser } from '@/lib/server/billing/summary'
import { serverEnv } from '@/lib/shared/env'
import { getServiceRoleClient } from '@/lib/server/supabase'

vi.mock('@/lib/server/supabase', () => ({
  getServiceRoleClient: vi.fn(),
}))

describe('buildBillingSummary', () => {
  const originalMeter = serverEnv.STRIPE_METER_OVERAGE
  const originalOveragePrice = serverEnv.STRIPE_PRICE_OVERAGE_PAGE

  afterEach(() => {
    serverEnv.STRIPE_METER_OVERAGE = originalMeter
    serverEnv.STRIPE_PRICE_OVERAGE_PAGE = originalOveragePrice
  })

  it('derives usage and overage readiness from the mirrored subscription state', () => {
    serverEnv.STRIPE_METER_OVERAGE = 'meter_pages'
    serverEnv.STRIPE_PRICE_OVERAGE_PAGE = 'price_overage_page'

    const summary = buildBillingSummary(
      {
        plan: 'starter',
        status: 'active',
        billing_cycle: 'monthly',
        current_period_end: '2026-06-01T00:00:00.000Z',
        cancel_at_period_end: false,
        stripe_customer_id: 'cus_123',
      },
      120,
    )

    expect(summary).toMatchObject({
      plan: 'starter',
      creditBalance: 120,
      monthlyCredits: 200,
      usedCredits: 80,
      overageAllowed: true,
      overageMeterConfigured: true,
      hasStripeCustomer: true,
    })
  })

  it('shows free workspaces as non-overage plans with included credits', () => {
    const summary = buildBillingSummary(null, null)

    expect(summary).toMatchObject({
      plan: 'free',
      creditBalance: 5,
      monthlyCredits: 5,
      usedCredits: 0,
      overageAllowed: false,
      overageMeterConfigured: false,
      hasStripeCustomer: false,
    })
  })
})

describe('getBillingSummaryForUser', () => {
  it('loads billing state through the trusted server client scoped by user workspace', async () => {
    const serviceRole = billingSupabase()
    vi.mocked(getServiceRoleClient).mockReturnValue(serviceRole as never)

    const summary = await getBillingSummaryForUser({ userId: 'user_123' })

    expect(summary).toMatchObject({
      plan: 'starter',
      creditBalance: 120,
      monthlyCredits: 200,
      usedCredits: 80,
      hasStripeCustomer: true,
    })
    expect(getServiceRoleClient).toHaveBeenCalled()
    expect(serviceRole.from).toHaveBeenCalledWith('user_profile')
    expect(serviceRole.from).toHaveBeenCalledWith('subscription')
    expect(serviceRole.from).toHaveBeenCalledWith('credit_ledger')
  })
})

function billingSupabase() {
  return {
    from: vi.fn((table: 'user_profile' | 'subscription' | 'credit_ledger') => ({
      select: vi.fn((columns: string) => {
        if (table === 'user_profile' && columns === 'workspace_id') {
          return eqBuilder({ singleResult: { workspace_id: 'workspace_123' } })
        }

        if (table === 'subscription') {
          return eqBuilder({
            maybeResult: {
              plan: 'starter',
              status: 'active',
              billing_cycle: 'monthly',
              current_period_end: '2026-06-01T00:00:00.000Z',
              cancel_at_period_end: false,
              stripe_customer_id: 'cus_123',
            },
          })
        }

        return eqBuilder({ maybeResult: { balance_after: 120 } })
      }),
    })),
  }
}

function eqBuilder(input: { singleResult?: unknown; maybeResult?: unknown }) {
  const result = {
    eq: vi.fn(() => result),
    single: vi.fn().mockResolvedValue({
      data: input.singleResult ?? null,
      error: null,
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: input.maybeResult ?? null,
      error: null,
    }),
    order: vi.fn(() => result),
    limit: vi.fn(() => result),
  }
  return result
}
