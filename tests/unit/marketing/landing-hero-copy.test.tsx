import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LandingHeroCopy } from '@/components/marketing/landing-hero-copy'

describe('LandingHeroCopy', () => {
  it('renders as a pure server component without client directives', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../../components/marketing/landing-hero-copy.tsx'),
      'utf8',
    )
    expect(source).not.toMatch(/^['"]use client['"]/m)
  })

  it('renders the eyebrow chip', () => {
    render(<LandingHeroCopy />)
    expect(screen.getByText(/BANK & CREDIT CARD STATEMENT CONVERTER/)).toBeInTheDocument()
  })

  it('renders the H1 with the QuickBooks and Xero headline', () => {
    render(<LandingHeroCopy />)
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Turn PDF Statements into QuickBooks and Xero.*Ready Files/i,
      }),
    ).toBeInTheDocument()
  })

  it('renders the value-prop paragraph naming all four supported targets', () => {
    render(<LandingHeroCopy />)
    expect(
      screen.getByText(/QuickBooks, Xero, CSV, and Excel/i, { exact: false }),
    ).toBeInTheDocument()
  })

  it('renders the four supported export formats inline', () => {
    render(<LandingHeroCopy />)
    const formats = screen.getByRole('list', { name: /Supported export formats/i })
    expect(within(formats).getByText('CSV')).toBeInTheDocument()
    expect(within(formats).getByText('Excel (XLSX)')).toBeInTheDocument()
    expect(within(formats).getByText('QuickBooks CSV')).toBeInTheDocument()
    expect(within(formats).getByText('Xero CSV')).toBeInTheDocument()
  })
})
