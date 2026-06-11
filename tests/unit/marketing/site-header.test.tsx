import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteHeader } from '@/components/marketing/site-header'

describe('SiteHeader', () => {
  it('renders the StatementStudio wordmark', () => {
    render(<SiteHeader />)
    expect(screen.getByRole('link', { name: /StatementStudio/i })).toBeInTheDocument()
  })

  it('does not expose middle nav anchors', () => {
    render(<SiteHeader />)
    expect(screen.queryByRole('link', { name: 'Pricing' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Features' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Security' })).not.toBeInTheDocument()
  })

  it('provides Login and Register entry points', () => {
    render(<SiteHeader />)
    const login = screen.getByRole('link', { name: 'Login' })
    expect(login).toHaveAttribute('href', '/login')

    const register = screen.getByRole('link', { name: 'Register' })
    expect(register).toHaveAttribute('href', '/register')
  })

  it('uses a banner landmark', () => {
    render(<SiteHeader />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })
})
