import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConversionStatusCard } from '@/components/marketing/conversion-status-card'

describe('ConversionStatusCard', () => {
  it('renders the header and a pill in the empty state', () => {
    render(<ConversionStatusCard variant="empty" />)
    expect(screen.getByRole('heading', { name: /Conversion status/i })).toBeInTheDocument()
    expect(screen.getByText(/No file uploaded/i)).toBeInTheDocument()
  })

  it('shows idle dashes for every row in the empty state', () => {
    const { container } = render(<ConversionStatusCard variant="empty" />)
    const valueCells = container.querySelectorAll('dd')
    const values = Array.from(valueCells).map((node) => node.textContent?.trim())
    expect(values).toEqual(['—', 'Waiting for upload', '—', '—', '—'])
  })

  it('reflects an uploading file with filename and size', () => {
    render(
      <ConversionStatusCard
        variant="uploading"
        filename="march-statement.pdf"
        sizeLabel="1.4 MB"
      />,
    )
    expect(screen.getByText('march-statement.pdf')).toBeInTheDocument()
    expect(screen.getByText('1.4 MB')).toBeInTheDocument()
    const pill = screen.getByText('Uploading')
    expect(pill).toHaveAttribute('data-variant', 'uploading')
  })

  it('exposes the variant on the card root for downstream styling', () => {
    const { container } = render(<ConversionStatusCard variant="ready" />)
    const root = container.querySelector('[data-variant]')
    expect(root).not.toBeNull()
    expect(root?.getAttribute('data-variant')).toBe('ready')
  })

  it('reserves a stable min-height so state changes do not shift layout', () => {
    const { container } = render(<ConversionStatusCard variant="empty" />)
    const card = container.querySelector('[data-card="conversion-status"]') as HTMLElement | null
    expect(card).not.toBeNull()
    expect(card?.style.minHeight).not.toBe('')
  })
})
