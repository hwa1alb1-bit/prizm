import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrustCards } from '@/components/marketing/trust-cards'

describe('TrustCards', () => {
  it('renders the four evidence cards with their new titles', () => {
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

  it('uses no nested cards (each card is a single bordered surface)', () => {
    const { container } = render(<TrustCards />)
    const cards = container.querySelectorAll('article[data-card]')
    expect(cards.length).toBe(4)
    cards.forEach((card) => {
      expect(card.querySelectorAll('article[data-card]').length).toBe(0)
    })
  })

  it('surfaces the reconciliation rule and a mismatch counter-example', () => {
    render(<TrustCards />)
    expect(screen.getByText(/deterministic reconciliation math/i)).toBeInTheDocument()
    expect(screen.getByText(/Mismatch flagged/i)).toBeInTheDocument()
  })

  it('links the Observatory card to the live security report', () => {
    render(<TrustCards />)
    const link = screen.getByRole('link', { name: /View the report/i })
    expect(link).toHaveAttribute(
      'href',
      'https://observatory.mozilla.org/analyze/pdftoexcelstatementconverter.com',
    )
  })
})
