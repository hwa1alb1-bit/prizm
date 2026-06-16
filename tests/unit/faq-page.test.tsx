import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FaqPage from '@/app/help/page'

describe('FAQ page', () => {
  it('renders all four question headings', () => {
    render(<FaqPage />)
    expect(screen.getByRole('heading', { name: /what counts as a "page"\?/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /can i cancel anytime\?/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /what if i exceed my quota\?/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /do unused pages roll over\?/i }),
    ).toBeInTheDocument()
  })

  it('explains that only transaction-bearing pages count', () => {
    render(<FaqPage />)
    expect(screen.getByText(/extracted at least one transaction row/i)).toBeInTheDocument()
  })
})
