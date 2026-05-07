import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ErrorDocsPage from '@/app/docs/errors/page'
import RateLimitsPage from '@/app/docs/rate-limits/page'
import PrivacyPage from '@/app/privacy/page'
import SecurityPage from '@/app/security/page'
import SubprocessorsPage from '@/app/security/subprocessors/page'
import StatusPage from '@/app/status/page'
import TermsPage from '@/app/terms/page'

describe('public trust pages', () => {
  it('publishes a security page that separates active controls from planned controls', () => {
    render(<SecurityPage />)

    expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Active Controls' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Planned Controls' })).toBeInTheDocument()
    expect(screen.getByText('security@prizmview.app')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Security policy' })).toHaveAttribute(
      'href',
      '/security/policy',
    )
    expect(screen.getByRole('link', { name: 'Subprocessors' })).toHaveAttribute(
      'href',
      '/security/subprocessors',
    )
  })

  it('publishes the core trust pages promised by the roadmap', () => {
    const pages = [
      { component: <PrivacyPage />, heading: 'Privacy', text: '24-hour document retention' },
      { component: <TermsPage />, heading: 'Terms', text: 'Alpha service terms' },
      { component: <StatusPage />, heading: 'Status', text: 'Launch readiness' },
      {
        component: <ErrorDocsPage />,
        heading: 'Error Responses',
        text: 'application/problem+json',
      },
      { component: <RateLimitsPage />, heading: 'Rate Limits', text: 'Retry-After' },
      { component: <SubprocessorsPage />, heading: 'Subprocessors', text: 'DPA' },
    ]

    for (const page of pages) {
      const { unmount } = render(page.component)
      expect(screen.getByRole('heading', { name: page.heading })).toBeInTheDocument()
      expect(screen.getAllByText(page.text, { exact: false }).length).toBeGreaterThan(0)
      unmount()
    }
  })
})
