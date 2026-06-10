import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteHeader } from '@/components/marketing/site-header'

describe('SiteHeader', () => {
  it('renders the StatementStudio wordmark', () => {
    render(<SiteHeader />)
    expect(screen.getByRole('link', { name: /StatementStudio/i })).toBeInTheDocument()
  })

  it('exposes Pricing, Features, and Security anchor links', () => {
    render(<SiteHeader />)
    const anchors = ['Pricing', 'Features', 'Security']
    for (const label of anchors) {
      const link = screen.getByRole('link', { name: label })
      expect(link).toHaveAttribute('href', `#${label.toLowerCase()}`)
    }
  })

  it('provides Login and Register entry points', () => {
    render(<SiteHeader />)
    const login = screen.getByRole('link', { name: 'Login' })
    expect(login).toHaveAttribute('href', '/login')

    const register = screen.getByRole('link', { name: 'Register' })
    expect(register).toHaveAttribute('href', '/register')
  })

  it('uses a banner landmark with a primary navigation', () => {
    render(<SiteHeader />)
    const banner = screen.getByRole('banner')
    expect(banner).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument()
  })
})
