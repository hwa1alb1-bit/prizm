import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrustCards } from '@/components/marketing/trust-cards'

describe('TrustCards', () => {
  it('renders the four feature tiles with the new titles', () => {
    render(<TrustCards />)
    for (const title of [
      'Encrypted Connection',
      'Files stay private',
      'Rapid processing',
      'Accounting & Bookkeeping Formatted',
    ]) {
      expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
    }
  })

  it('uses no nested cards (each tile is a single bordered surface)', () => {
    const { container } = render(<TrustCards />)
    const tiles = container.querySelectorAll('[data-tile-root="trust"]')
    expect(tiles.length).toBe(4)
    tiles.forEach((tile) => {
      expect(tile.querySelectorAll('[data-tile-root="trust"]').length).toBe(0)
    })
  })

  it('renders the TLS 1.2+ encryption body for the Encrypted Connection tile', () => {
    render(<TrustCards />)
    expect(screen.getByText(/secure TLS 1\.2\+ encrypted transfer/i)).toBeInTheDocument()
  })

  it('renders the no-training-on-uploads body for the Files stay private tile', () => {
    render(<TrustCards />)
    expect(screen.getByText(/never shared or used to train AI models/i)).toBeInTheDocument()
  })
})
