import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PricingSection } from '@/components/marketing/pricing-section'

describe('PricingSection', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ url: 'https://checkout.stripe.com/s/test' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('renders three pricing tiles with mockup-aligned headlines', () => {
    render(<PricingSection isAuthenticated={false} />)
    expect(screen.getByRole('heading', { level: 2, name: /Simple pricing/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Free' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Starter' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Pro' })).toBeInTheDocument()
  })

  it('shows the real Stripe prices for Starter and Pro and the $0 Free signup tier', () => {
    render(<PricingSection isAuthenticated={false} />)
    expect(screen.getAllByText(/\$0/).length).toBeGreaterThan(0)
    expect(screen.getByText(/\$19/)).toBeInTheDocument()
    expect(screen.getByText(/\$49/)).toBeInTheDocument()
    expect(screen.getByText(/5 pages per month/i)).toBeInTheDocument()
    expect(screen.getByText(/200 pages per month/i)).toBeInTheDocument()
    expect(screen.getByText(/1,000 pages per month/i)).toBeInTheDocument()
  })

  it('marks Starter as Most popular', () => {
    render(<PricingSection isAuthenticated={false} />)
    const ribbon = screen.getByText(/Most popular/i)
    const starterTile = ribbon.closest('[data-tile-root="pricing"]')
    expect(starterTile).not.toBeNull()
    expect(within(starterTile as HTMLElement).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Starter',
    )
  })

  it('routes the Free tile to /register', () => {
    render(<PricingSection isAuthenticated={false} />)
    expect(screen.getByRole('link', { name: /Get started/i })).toHaveAttribute('href', '/register')
  })

  it('routes anonymous paid CTAs to /register with next=/app/account', () => {
    render(<PricingSection isAuthenticated={false} />)
    const subscribeCtas = screen.getAllByRole('link', { name: /Subscribe/i })
    for (const cta of subscribeCtas) {
      expect(cta).toHaveAttribute('href', '/register?next=/app/account')
    }
  })

  it('renders Subscribe buttons (not links) for authenticated users', () => {
    render(<PricingSection isAuthenticated={true} />)
    expect(screen.queryAllByRole('link', { name: /Subscribe/i })).toHaveLength(0)
    expect(screen.getAllByRole('button', { name: /Subscribe/i })).toHaveLength(2)
  })

  it('POSTs Stripe checkout for the authenticated Starter click', async () => {
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    })

    render(<PricingSection isAuthenticated={true} />)
    const starterTile = screen
      .getByRole('heading', { name: 'Starter' })
      .closest('[data-tile-root="pricing"]') as HTMLElement
    await userEvent.click(within(starterTile).getByRole('button', { name: /Subscribe/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/billing/checkout',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ plan: 'starter', billingCycle: 'monthly' }),
        }),
      )
    })
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/s/test')
    })
  })

  it('POSTs Stripe checkout for the authenticated Pro click', async () => {
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    })

    render(<PricingSection isAuthenticated={true} />)
    const proTile = screen
      .getByRole('heading', { name: 'Pro' })
      .closest('[data-tile-root="pricing"]') as HTMLElement
    await userEvent.click(within(proTile).getByRole('button', { name: /Subscribe/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/billing/checkout',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ plan: 'pro', billingCycle: 'monthly' }),
        }),
      )
    })
  })

  it('surfaces a checkout error when the API returns a problem', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ status: 500, title: 'Checkout failed', detail: 'Stripe is down.' }),
            { status: 500, headers: { 'content-type': 'application/problem+json' } },
          ),
        ),
    )

    render(<PricingSection isAuthenticated={true} />)
    const starterTile = screen
      .getByRole('heading', { name: 'Starter' })
      .closest('[data-tile-root="pricing"]') as HTMLElement
    await userEvent.click(within(starterTile).getByRole('button', { name: /Subscribe/i }))

    expect(await screen.findByText(/Stripe is down/i)).toBeInTheDocument()
  })

  it('does not advertise specific export format names on the Free tier', () => {
    render(<PricingSection isAuthenticated={false} />)
    expect(screen.queryByText(/XLSX, CSV, QuickBooks CSV, Xero CSV/)).toBeNull()
  })
})
