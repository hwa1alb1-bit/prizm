import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import IntegratePage, { generateMetadata } from '@/app/integrate/[slug]/page'
import { MARKETING_INTEGRATIONS } from '@/lib/marketing/marketing-integrations'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error('notFound')
  },
}))

describe('Integrate slug page', () => {
  it('renders an H1 referencing the software name for every integration', async () => {
    for (const integration of MARKETING_INTEGRATIONS) {
      const Page = await IntegratePage({
        params: Promise.resolve({ slug: integration.slug }),
      })
      const { unmount } = render(Page)
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading.textContent).toContain(integration.name)
      unmount()
    }
  })

  it('renders the upload dropzone on each integrate page', async () => {
    const Page = await IntegratePage({ params: Promise.resolve({ slug: 'quickbooks-online' }) })
    render(Page)
    expect(screen.getByRole('button', { name: /Upload PDF statement/i })).toBeInTheDocument()
  })

  it('renders the import column mapping table', async () => {
    const Page = await IntegratePage({ params: Promise.resolve({ slug: 'xero' }) })
    render(Page)
    expect(screen.getByRole('table', { name: /import column mapping/i })).toBeInTheDocument()
  })
})

describe('Integrate slug metadata', () => {
  it('builds the trimmed PDF-to-{Software}-CSV title pattern that fits SEO length limits', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'quickbooks-online' }),
    })
    const title = metadata.title as { absolute: string }
    expect(title.absolute).toBe('PDF statement to QuickBooks Online CSV | StatementStudio')
    expect(metadata.alternates?.canonical).toBe('/integrate/quickbooks-online')
  })
})
