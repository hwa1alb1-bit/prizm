import { describe, expect, it } from 'vitest'
import { calculateConversionBillingUsage } from '@/lib/server/billing/credits'

describe('calculateConversionBillingUsage', () => {
  it('debits included credits when the workspace has enough balance', () => {
    expect(
      calculateConversionBillingUsage({
        plan: 'starter',
        status: 'active',
        pages: 12,
        creditBalance: 20,
        overageMeterConfigured: true,
      }),
    ).toEqual({
      allowed: true,
      creditDebit: 12,
      overagePages: 0,
      balanceAfter: 8,
    })
  })

  it('uses remaining credits first and reports paid overage pages for active paid plans', () => {
    expect(
      calculateConversionBillingUsage({
        plan: 'pro',
        status: 'active',
        pages: 12,
        creditBalance: 5,
        overageMeterConfigured: true,
      }),
    ).toEqual({
      allowed: true,
      creditDebit: 5,
      overagePages: 7,
      balanceAfter: 0,
    })
  })

  it('blocks free conversions that exceed available credits', () => {
    expect(
      calculateConversionBillingUsage({
        plan: 'free',
        status: 'active',
        pages: 12,
        creditBalance: 5,
        overageMeterConfigured: true,
      }),
    ).toMatchObject({
      allowed: false,
      reason: 'credits_exhausted',
      problemCode: 'PRZM_BILLING_CREDITS_EXHAUSTED',
    })
  })

  it('blocks paid overage when Stripe metering is missing', () => {
    expect(
      calculateConversionBillingUsage({
        plan: 'starter',
        status: 'active',
        pages: 12,
        creditBalance: 5,
        overageMeterConfigured: false,
      }),
    ).toMatchObject({
      allowed: false,
      reason: 'overage_not_configured',
      problemCode: 'PRZM_BILLING_OVERAGE_NOT_CONFIGURED',
    })
  })
})
