import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

let mockPathname = '/app'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

import { DashboardNav } from '@/components/layout/dashboard-nav'

describe('DashboardNav', () => {
  it('renders Upload and Account nav links on /app', () => {
    mockPathname = '/app'
    render(<DashboardNav />)
    const uploads = screen.getAllByRole('link', { name: 'Upload' })
    const accounts = screen.getAllByRole('link', { name: 'Account' })
    expect(uploads.length).toBeGreaterThan(0)
    expect(accounts.length).toBeGreaterThan(0)
    for (const link of uploads) expect(link).toHaveAttribute('href', '/app')
    for (const link of accounts) expect(link).toHaveAttribute('href', '/app/account')
  })

  it('renders nothing on /app/account so the page is full-width', () => {
    mockPathname = '/app/account'
    const { container } = render(<DashboardNav />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('link', { name: 'Upload' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Account' })).toBeNull()
  })
})
