import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BillingDashboard } from '@/components/billing/billing-dashboard'

const assign = vi.fn()

describe('BillingDashboard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders plan, credit balance, renewal, and portal controls', () => {
    render(
      <BillingDashboard
        summary={{
          plan: 'starter',
          status: 'active',
          billingCycle: 'monthly',
          creditBalance: 120,
          monthlyCredits: 200,
          usedCredits: 80,
          overageAllowed: true,
          overageMeterConfigured: true,
          currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          cancelAtPeriodEnd: false,
          hasStripeCustomer: true,
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument()
    expect(screen.getAllByText('Starter').length).toBeGreaterThan(0)
    expect(screen.getByText('120 / 200 credits')).toBeInTheDocument()
    expect(screen.getByText('80 used this period')).toBeInTheDocument()
    expect(screen.getByText('40% of included credits used')).toBeInTheDocument()
    expect(screen.getByText('Overage metering configured')).toBeInTheDocument()
    expect(screen.getByText('Renews 2026-06-01')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open portal' })).toBeInTheDocument()
    expect(
      screen.getByText('Invoices and receipts are managed in the Stripe portal.'),
    ).toBeInTheDocument()
  })

  it('starts Checkout for selected monthly and annual paid plans', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/c/session_123' }),
    }) as never
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign },
    })

    render(
      <BillingDashboard
        summary={{
          plan: 'free',
          status: 'active',
          billingCycle: null,
          creditBalance: 2,
          monthlyCredits: 5,
          usedCredits: 3,
          overageAllowed: false,
          overageMeterConfigured: false,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          hasStripeCustomer: false,
        }}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Starter monthly' }))

    expect(global.fetch).toHaveBeenCalledWith('/api/v1/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'starter', billingCycle: 'monthly' }),
    })
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/session_123')

    await userEvent.click(screen.getByRole('button', { name: 'Pro annual' }))

    expect(global.fetch).toHaveBeenLastCalledWith('/api/v1/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro', billingCycle: 'annual' }),
    })
  })
})
