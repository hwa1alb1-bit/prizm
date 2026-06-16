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

  it('renders a credits chip when authed and credits are provided', () => {
    render(<AppHeader authed credits={{ used: 57, included: 200 }} />)
    expect(screen.getByText('57')).toBeInTheDocument()
    expect(screen.getByText('/200')).toBeInTheDocument()
    expect(screen.getByText(/Pages/i)).toBeInTheDocument()
  })

  it('omits the credits chip when credits are not provided', () => {
    render(<AppHeader authed />)
    expect(screen.queryByText(/Pages/i)).toBeNull()
  })

  it('does not render the credits chip for unauthenticated visitors', () => {
    render(<AppHeader authed={false} credits={{ used: 1, included: 5 }} />)
    expect(screen.queryByText(/Pages/i)).toBeNull()
  })

  it('renders the free-plan daily chip with a today suffix', () => {
    render(<AppHeader authed credits={{ used: 3, included: 5, window: 'daily' }} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('/5')).toBeInTheDocument()
    expect(screen.getByText(/today/i)).toBeInTheDocument()
    expect(screen.queryByText(/^Pages$/i)).toBeNull()
  })

  it('renders the monthly Pages suffix when window is omitted', () => {
    render(<AppHeader authed credits={{ used: 12, included: 200 }} />)
    expect(screen.getByText(/Pages/i)).toBeInTheDocument()
    expect(screen.queryByText(/today/i)).toBeNull()
  })

  it('shows a FAQ link in the header when unauthenticated', () => {
    render(<AppHeader authed={false} />)
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq')
  })

  it('shows a FAQ link in the header when authenticated', () => {
    render(<AppHeader authed />)
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq')
  })
})
