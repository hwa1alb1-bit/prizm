import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteFooter } from '@/components/marketing/site-footer'

describe('SiteFooter', () => {
  it('renders a contentinfo landmark', () => {
    render(<SiteFooter />)
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('shows the StatementStudio copyright line for the current year', () => {
    render(<SiteFooter />)
    const year = new Date().getFullYear()
    expect(
      screen.getByText(new RegExp(`${year}.*StatementStudio.*All rights reserved`, 'i')),
    ).toBeInTheDocument()
  })

  it('links to API Docs, Privacy, Terms, and Contact', () => {
    render(<SiteFooter />)
    expect(screen.getByRole('link', { name: 'API Docs' })).toHaveAttribute('href', '/docs/errors')
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
    const contact = screen.getByRole('link', { name: 'Contact' })
    expect(contact.getAttribute('href')).toMatch(/^mailto:/)
  })

  it('flows link equity to the proof and conversion pages from the footer', () => {
    render(<SiteFooter />)
    expect(screen.getByRole('link', { name: /How we verify/i })).toHaveAttribute(
      'href',
      '/how-we-verify',
    )
    expect(screen.getByRole('link', { name: /Throughput/i })).toHaveAttribute('href', '/throughput')
    expect(screen.getByRole('link', { name: /Supported issuers/i })).toHaveAttribute(
      'href',
      '/issuers',
    )
    expect(screen.getByRole('link', { name: /Sample output/i })).toHaveAttribute(
      'href',
      '/sample-output',
    )
    expect(screen.getByRole('link', { name: /Conversion FAQ/i })).toHaveAttribute(
      'href',
      '/faq/bank-statement-conversion',
    )
  })

  it('exposes Product, Trust, Resources, and Legal column landmarks', () => {
    render(<SiteFooter />)
    expect(screen.getByRole('navigation', { name: /Product/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /Trust/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /Resources/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /Legal/i })).toBeInTheDocument()
  })
})
