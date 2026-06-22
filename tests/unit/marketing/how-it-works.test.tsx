import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HowItWorks } from '@/components/marketing/how-it-works'

describe('HowItWorks', () => {
  it('renders the heading', () => {
    render(<HowItWorks />)
    expect(
      screen.getByRole('heading', { level: 2, name: /From PDF to clean spreadsheet/i }),
    ).toBeInTheDocument()
  })

  it('renders four numbered steps in order', () => {
    render(<HowItWorks />)
    const list = screen.getByRole('list')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    const titles = [
      'Securely upload your PDF',
      'We extract the data',
      'Review and verify',
      'Export clean files',
    ]
    titles.forEach((title, index) => {
      expect(items[index]).toHaveTextContent(title)
    })
  })

  it('does not name a TLS version in the upload step body', () => {
    render(<HowItWorks />)
    expect(screen.queryByText(/TLS 1\.2/)).toBeNull()
  })
})
