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
})
