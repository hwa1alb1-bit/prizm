import { describe, expect, it } from 'vitest'
import { evaluateBillingGate, getPlanAllowance } from '@/lib/server/billing/plan'

describe('billing plan gates', () => {
  it('defines monthly conversion credit allowances by plan', () => {
    expect(getPlanAllowance('free')).toMatchObject({
      monthlyCredits: 5,
      overageAllowed: false,
    })
    expect(getPlanAllowance('starter')).toMatchObject({
      monthlyCredits: 200,
      overageAllowed: true,
    })
    expect(getPlanAllowance('pro')).toMatchObject({
      monthlyCredits: 1000,
      overageAllowed: true,
    })
  })

  it('allows active paid plans to continue when included credits are exhausted and metering is configured', () => {
    expect(
      evaluateBillingGate({
        plan: 'starter',
        status: 'active',
        creditBalance: 0,
        overageMeterConfigured: true,
      }),
    ).toEqual({ allowed: true, mode: 'metered_overage' })
  })

  it('blocks free plans when conversion credits are exhausted', () => {
    expect(
      evaluateBillingGate({
        plan: 'free',
        status: 'active',
        creditBalance: 0,
        overageMeterConfigured: true,
      }),
    ).toMatchObject({
      allowed: false,
      reason: 'credits_exhausted',
      problemCode: 'PRZM_BILLING_CREDITS_EXHAUSTED',
    })
  })

  it('fails closed for paid plans in failed-payment states', () => {
    expect(
      evaluateBillingGate({
        plan: 'pro',
        status: 'past_due',
        creditBalance: 50,
        overageMeterConfigured: true,
      }),
    ).toMatchObject({
      allowed: false,
      reason: 'payment_required',
      problemCode: 'PRZM_BILLING_PAYMENT_REQUIRED',
    })
  })

  it('allows a free conversion when daily pages used + requested stays within the 5/day limit', () => {
    expect(
      evaluateBillingGate({
        plan: 'free',
        status: 'active',
        creditBalance: 0,
        overageMeterConfigured: false,
        dailyPagesUsed: 2,
        requestedPages: 3,
      }),
    ).toEqual({ allowed: true, mode: 'included_credit' })
  })

  it('blocks a free conversion when daily pages used + requested would exceed 5', () => {
    expect(
      evaluateBillingGate({
        plan: 'free',
        status: 'active',
        creditBalance: 0,
        overageMeterConfigured: false,
        dailyPagesUsed: 4,
        requestedPages: 2,
      }),
    ).toMatchObject({
      allowed: false,
      reason: 'daily_limit_reached',
      problemCode: 'PRZM_BILLING_DAILY_LIMIT_REACHED',
    })
  })

  it('blocks a free conversion when the daily counter is already at the limit', () => {
    expect(
      evaluateBillingGate({
        plan: 'free',
        status: 'active',
        creditBalance: 0,
        overageMeterConfigured: false,
        dailyPagesUsed: 5,
        requestedPages: 1,
      }),
    ).toMatchObject({
      allowed: false,
      reason: 'daily_limit_reached',
    })
  })

  it('falls back to the legacy credits_exhausted gate when free dailyPagesUsed is not provided', () => {
    expect(
      evaluateBillingGate({
        plan: 'free',
        status: 'active',
        creditBalance: 0,
        overageMeterConfigured: false,
      }),
    ).toMatchObject({
      allowed: false,
      reason: 'credits_exhausted',
    })
  })
})
