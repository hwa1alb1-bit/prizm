import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrustCards } from '@/components/marketing/trust-cards'

describe('TrustCards', () => {
  it('renders the four trust tiles with mockup titles', () => {
    render(<TrustCards />)
    for (const title of ['Secure by design', 'Highly accurate', 'Blazing fast', 'Audit-ready']) {
      expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
    }
  })

  it('uses no nested cards (each tile is a single bordered surface)', () => {
    const { container } = render(<TrustCards />)
    // Each tile root has data-tile-root; assert no tile contains another tile root.
    const tiles = container.querySelectorAll('[data-tile-root="trust"]')
    expect(tiles.length).toBe(4)
    tiles.forEach((tile) => {
      expect(tile.querySelectorAll('[data-tile-root="trust"]').length).toBe(0)
    })
  })
})
