import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

let mockPathname = '/app'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

import { DashboardNav } from '@/components/layout/dashboard-nav'

describe('DashboardNav', () => {
  it('renders nothing on /app — AppHeader brand mark already routes here', () => {
    mockPathname = '/app'
    const { container } = render(<DashboardNav />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('link', { name: 'Upload' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Account' })).toBeNull()
  })

  it('renders nothing on /app/account so the page is full-width', () => {
    mockPathname = '/app/account'
    const { container } = render(<DashboardNav />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('link', { name: 'Upload' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Account' })).toBeNull()
  })

  it('still renders on other authed sub-routes (e.g. /app/history)', () => {
    mockPathname = '/app/history'
    render(<DashboardNav />)
    expect(screen.getAllByRole('link', { name: 'Upload' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Account' }).length).toBeGreaterThan(0)
  })
})
