import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RelatedPagesRail } from '@/components/marketing/related-pages-rail'

describe('RelatedPagesRail', () => {
  it('renders at least four sibling internal links on a /bank/[slug] page', () => {
    render(<RelatedPagesRail kind="bank" currentSlug="chase" />)
    const nav = screen.getByRole('navigation', { name: 'Related pages' })
    const links = nav.querySelectorAll('a')
    expect(links.length).toBeGreaterThanOrEqual(4)
  })

  it('omits the current bank from its own sibling list to avoid a self-link', () => {
    render(<RelatedPagesRail kind="bank" currentSlug="chase" />)
    const nav = screen.getByRole('navigation', { name: 'Related pages' })
    const hrefs = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).not.toContain('/bank/chase')
  })

  it('omits the current integration from its own sibling list', () => {
    render(<RelatedPagesRail kind="integration" currentSlug="quickbooks-online" />)
    const nav = screen.getByRole('navigation', { name: 'Related pages' })
    const hrefs = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).not.toContain('/integrate/quickbooks-online')
  })

  it('links every convert page to both integrations and at least one bank page', () => {
    render(<RelatedPagesRail kind="convert" currentSlug="chase-excel" />)
    const nav = screen.getByRole('navigation', { name: 'Related pages' })
    const hrefs = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/integrate/quickbooks-online')
    expect(hrefs).toContain('/integrate/xero')
    expect(hrefs.some((href) => href?.startsWith('/bank/'))).toBe(true)
  })
})
