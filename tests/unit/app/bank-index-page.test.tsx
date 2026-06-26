import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BankIndexPage from '@/app/bank/page'
import { MARKETING_BANKS } from '@/lib/marketing/marketing-banks'

describe('Bank index page', () => {
  it('renders an H1 about supported banks', () => {
    render(<BankIndexPage />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('links to a dedicated /bank/[slug] page for every marketing bank', () => {
    render(<BankIndexPage />)
    for (const bank of MARKETING_BANKS) {
      expect(screen.getByRole('link', { name: new RegExp(bank.name, 'i') })).toHaveAttribute(
        'href',
        `/bank/${bank.slug}`,
      )
    }
  })
})
