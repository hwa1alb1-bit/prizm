import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PricingSection } from '@/components/marketing/pricing-section'

describe('PricingSection', () => {
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

  it('routes anonymous users to /register and signed-in users to /app/billing', () => {
    render(<PricingSection isAuthenticated={false} />)
    const subscribeCtas = screen.getAllByRole('link', { name: /Subscribe/i })
    for (const cta of subscribeCtas) {
      expect(cta).toHaveAttribute('href', '/register?next=/app/billing')
    }
    expect(screen.getByRole('link', { name: /Get started/i })).toHaveAttribute('href', '/register')
  })

  it('routes signed-in users straight to /app/billing for paid plans', () => {
    render(<PricingSection isAuthenticated={true} />)
    const subscribeCtas = screen.getAllByRole('link', { name: /Subscribe/i })
    for (const cta of subscribeCtas) {
      expect(cta).toHaveAttribute('href', '/app/billing')
    }
  })
})
