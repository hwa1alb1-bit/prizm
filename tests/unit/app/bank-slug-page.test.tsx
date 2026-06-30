import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BankSlugPage, { generateMetadata } from '@/app/bank/[slug]/page'
import { MARKETING_BANKS } from '@/lib/marketing/marketing-banks'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error('notFound')
  },
}))

describe('Bank slug page', () => {
  it('renders an H1 with the bank name for every supported bank', async () => {
    for (const bank of MARKETING_BANKS) {
      const Page = await BankSlugPage({ params: Promise.resolve({ slug: bank.slug }) })
      const { unmount } = render(Page)
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading.textContent).toContain(bank.name)
      unmount()
    }
  })

  it('renders the upload dropzone on each bank page', async () => {
    const Page = await BankSlugPage({ params: Promise.resolve({ slug: 'chase' }) })
    render(Page)
    expect(screen.getByRole('button', { name: /Upload PDF statement/i })).toBeInTheDocument()
  })

  it('discloses generic-fallback engine status for non-native banks (E-E-A-T honesty)', async () => {
    const Page = await BankSlugPage({ params: Promise.resolve({ slug: 'wells-fargo' }) })
    render(Page)
    expect(screen.getAllByText(/Generic structural parser/i).length).toBeGreaterThan(0)
  })

  it('confirms native engine status for Chase and BoA', async () => {
    const chasePage = await BankSlugPage({ params: Promise.resolve({ slug: 'chase' }) })
    const { unmount: unmountChase } = render(chasePage)
    expect(screen.getByText(/Native parser/i)).toBeInTheDocument()
    unmountChase()

    const boaPage = await BankSlugPage({ params: Promise.resolve({ slug: 'bank-of-america' }) })
    render(boaPage)
    expect(screen.getByText(/Native parser/i)).toBeInTheDocument()
  })
})

describe('Bank slug metadata', () => {
  it('builds the trimmed bank-converter title pattern that fits SEO length limits', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'chase' }) })
    const title = metadata.title as { absolute: string }
    expect(title.absolute).toBe('Chase PDF statement converter | StatementStudio')
    expect(metadata.alternates?.canonical).toBe('/bank/chase')
  })

  it('uses the bank name in the description', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'wells-fargo' }),
    })
    expect(metadata.description).toMatch(/Wells Fargo/)
  })
})
