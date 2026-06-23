import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrustCards } from '@/components/marketing/trust-cards'

describe('TrustCards', () => {
  it('renders the four evidence tiles with their titles', () => {
    render(<TrustCards />)
    for (const title of [
      'Reconciled to the cent',
      'Throughput, measured',
      'Files auto-delete in 24h',
      'Mozilla Observatory A+',
    ]) {
      expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
    }
  })

  it('uses no nested cards (each tile is a single bordered surface)', () => {
    const { container } = render(<TrustCards />)
    const tiles = container.querySelectorAll('[data-card]')
    expect(tiles.length).toBe(4)
    tiles.forEach((tile) => {
      expect(tile.querySelectorAll('[data-card]').length).toBe(0)
    })
  })

  it('routes each tile to its evidence artifact', () => {
    render(<TrustCards />)
    expect(screen.getByRole('link', { name: /How reconciliation works/i })).toHaveAttribute(
      'href',
      '/how-we-verify',
    )
    expect(screen.getByRole('link', { name: /See the full benchmark/i })).toHaveAttribute(
      'href',
      '/throughput',
    )
    expect(screen.getByRole('link', { name: /Retention policy/i })).toHaveAttribute(
      'href',
      '/security/policy',
    )
  })

  it('links the Observatory tile to the live security report', () => {
    render(<TrustCards />)
    const link = screen.getByRole('link', { name: /View the report/i })
    expect(link).toHaveAttribute(
      'href',
      'https://observatory.mozilla.org/analyze/pdftoexcelstatementconverter.com',
    )
  })
})
