import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppHeader } from '@/components/layout/app-header'

describe('AppHeader', () => {
  it('renders the StatementStudio brand mark linking to /', () => {
    render(<AppHeader authed={false} />)
    const homeLink = screen.getByRole('link', { name: /StatementStudio home/i })
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('shows Login and Register when the user is not authenticated', () => {
    render(<AppHeader authed={false} />)
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register')
    expect(screen.queryByRole('link', { name: 'Account' })).toBeNull()
  })

  it('shows Account when the user is authenticated and hides Login and Register', () => {
    render(<AppHeader authed={true} />)
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/app/account')
    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Register' })).toBeNull()
  })

  it('honors a custom accountHref so PR3 can route to /app/settings until /app/account ships', () => {
    render(<AppHeader authed={true} accountHref="/app/settings" />)
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/app/settings')
  })

  it('renders as a header landmark', () => {
    render(<AppHeader authed={false} />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })
})
