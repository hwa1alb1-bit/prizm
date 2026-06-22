import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusPill } from '@/components/marketing/status-pill'

describe('StatusPill', () => {
  it('renders the empty variant with the neutral palette and idle label', () => {
    render(<StatusPill variant="empty" />)
    const pill = screen.getByText(/No file uploaded/i)
    expect(pill).toHaveAttribute('data-variant', 'empty')
  })

  it('renders the uploading variant', () => {
    render(<StatusPill variant="uploading" />)
    expect(screen.getByText(/Uploading/i)).toHaveAttribute('data-variant', 'uploading')
  })

  it('renders the processing variant', () => {
    render(<StatusPill variant="processing" />)
    expect(screen.getByText(/Processing|Extracting/i)).toHaveAttribute('data-variant', 'processing')
  })

  it('renders the ready variant', () => {
    render(<StatusPill variant="ready" />)
    expect(screen.getByText(/Ready/i)).toHaveAttribute('data-variant', 'ready')
  })

  it('renders the failed variant', () => {
    render(<StatusPill variant="failed" />)
    expect(screen.getByText(/Failed|Error/i)).toHaveAttribute('data-variant', 'failed')
  })

  it('accepts a custom label override', () => {
    render(<StatusPill variant="ready" label="Export ready" />)
    expect(screen.getByText('Export ready')).toBeInTheDocument()
  })
})
