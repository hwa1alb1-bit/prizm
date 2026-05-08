export type BillingPlan = 'free' | 'starter' | 'pro'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'

export type BillingSummary = {
  plan: BillingPlan
  status: SubscriptionStatus
  billingCycle: 'monthly' | 'annual' | null
  creditBalance: number
  monthlyCredits: number
  usedCredits: number
  overageAllowed: boolean
  overageMeterConfigured: boolean
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  hasStripeCustomer: boolean
}
