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
})
