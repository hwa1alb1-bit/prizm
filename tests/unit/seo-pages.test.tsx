import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HomePage from '@/app/page'
import BankStatementConverterPage from '@/app/bank-statement-converter/page'
import BankStatementToCsvPage from '@/app/bank-statement-to-csv/page'
import BankStatementToExcelPage from '@/app/bank-statement-to-excel/page'
import ScannedBankStatementsPage from '@/app/convert-scanned-bank-statements/page'
import BankStatementConversionFaqPage from '@/app/faq/bank-statement-conversion/page'

const pages = [
  {
    component: <BankStatementConverterPage />,
    heading: 'Bank Statement Converter for Excel and CSV',
    text: 'secure upload, extraction, review, and export path',
  },
  {
    component: <BankStatementToExcelPage />,
    heading: 'Convert PDF Bank Statements to Excel',
    text: 'date, description, debit, credit, balance',
  },
  {
    component: <BankStatementToCsvPage />,
    heading: 'Convert Bank Statements to CSV',
    text: 'review the imported data inside your accounting system',
  },
  {
    component: <ScannedBankStatementsPage />,
    heading: 'Convert Scanned Bank Statements Into Spreadsheet Data',
    text: 'cropped edges, blur, handwriting, or low contrast can reduce extraction quality',
  },
  {
    component: <BankStatementConversionFaqPage />,
    heading: 'Bank Statement Conversion FAQ',
    text: 'How do I convert a bank statement to Excel?',
  },
]

describe('public SEO pages', () => {
  it('publishes the homepage as a converter-first Evidence Ledger surface', () => {
    render(<HomePage />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Convert Bank Statements to Excel, CSV, or Google Sheets',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start conversion' })).toHaveAttribute(
      'href',
      '/register',
    )
    expect(screen.getByText('Upload')).toBeInTheDocument()
    expect(screen.getByText('Extract')).toBeInTheDocument()
    expect(screen.getAllByText('Review').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Export').length).toBeGreaterThan(0)
    expect(screen.getByText('24-hour retention window')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'convert bank statements to Excel' })).toHaveAttribute(
      'href',
      '/bank-statement-to-excel',
    )
  })

  it('renders each SEO route with unique useful copy and internal links', () => {
    for (const page of pages) {
      const { unmount } = render(page.component)

      expect(screen.getByRole('heading', { level: 1, name: page.heading })).toBeInTheDocument()
      expect(screen.getAllByText(page.text, { exact: false }).length).toBeGreaterThan(0)
      expect(screen.getByRole('link', { name: /Start conversion/i })).toHaveAttribute(
        'href',
        '/register',
      )
      expect(screen.getByRole('link', { name: /bank statement to Excel/i })).toHaveAttribute(
        'href',
        '/bank-statement-to-excel',
      )
      expect(screen.getByRole('link', { name: /bank statement to CSV/i })).toHaveAttribute(
        'href',
        '/bank-statement-to-csv',
      )

      unmount()
    }
  })

  it('includes FAQ schema on the FAQ route', () => {
    const { container } = render(<BankStatementConversionFaqPage />)
    const schema = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map(
      (node) => JSON.parse(node.textContent ?? '{}') as { '@type'?: string },
    )

    expect(schema.some((item) => item['@type'] === 'FAQPage')).toBe(true)
  })
})
