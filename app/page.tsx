import Link from 'next/link'
import { JsonLd } from '@/components/marketing/json-ld'
import { relatedConversionLinks } from '@/lib/seo/conversion-pages'
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildPageMetadata,
  buildSoftwareApplicationJsonLd,
} from '@/lib/seo/site'

export const metadata = buildPageMetadata({
  title: 'Bank Statement Converter to Excel | PrizmView',
  description:
    'Convert PDF bank statements into clean Excel or CSV files with secure processing, clear exports, and reconciliation-ready review.',
  path: '/',
})

const workflow = [
  {
    label: 'Upload',
    detail: 'Add one PDF statement, check the hash, and confirm the one-credit quote.',
  },
  {
    label: 'Extract',
    detail: 'Rows, balances, and statement metadata resolve into a review record.',
  },
  {
    label: 'Review',
    detail: 'Inspect dates, descriptions, debits, credits, balances, and exceptions.',
  },
  {
    label: 'Export',
    detail: 'Download XLSX, CSV, QuickBooks CSV, or Xero CSV after review.',
  },
]

const conversionRows = [
  ['05/01/2026', 'Client deposit', '', '2,450.00', '8,902.14'],
  ['05/03/2026', 'Card payment', '186.33', '', '8,715.81'],
  ['05/06/2026', 'Bank fee', '12.00', '', '8,703.81'],
]

const evidenceFacts = [
  { label: 'Input', value: 'PDF bank and credit-card statements' },
  { label: 'Output', value: 'Excel, CSV, QuickBooks CSV, Xero CSV' },
  { label: 'Review', value: 'Transactions checked before export' },
  { label: 'Retention', value: '24-hour retention window' },
]

const trustLinks = [
  { href: '/security', label: 'Security controls' },
  { href: '/privacy', label: 'Privacy handling' },
  { href: '/status', label: 'Launch status' },
  { href: '/security/subprocessors', label: 'Subprocessors' },
]

export default function Home() {
  return (
    <main className="flex-1 bg-background text-foreground">
      <JsonLd data={buildOrganizationJsonLd()} />
      <JsonLd data={buildSoftwareApplicationJsonLd()} />
      <JsonLd data={buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }])} />

      <section className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(26rem,1fr)] lg:items-center lg:px-8 lg:py-18">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/50">
            PrizmView bank statement converter
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-foreground sm:text-5xl">
            Convert Bank Statements to Excel, CSV, or Google Sheets
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-foreground/70 sm:text-lg">
            Upload a PDF statement, review extracted transaction rows, then export spreadsheet data
            your accounting workflow can use. PrizmView keeps conversion evidence visible from
            upload to retention.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:opacity-90 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Start conversion
            </Link>
            <Link
              href="/security"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[var(--border-subtle)] px-5 text-sm font-medium transition hover:bg-[var(--surface-muted)] active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Review security
            </Link>
          </div>

          <dl className="mt-10 grid gap-4 sm:grid-cols-2">
            {evidenceFacts.map((fact) => (
              <div key={fact.label} className="border-t border-[var(--border-subtle)] pt-4">
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/45">
                  {fact.label}
                </dt>
                <dd className="mt-2 text-sm font-medium">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside
          className="min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4"
          aria-label="Converted statement preview"
        >
          <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/45">
                Conversion workbench
              </p>
              <h2 className="mt-2 text-lg font-semibold">May Statement.pdf</h2>
            </div>
            <span className="inline-flex min-h-7 w-fit items-center rounded-full bg-[color-mix(in_oklch,var(--success)_16%,transparent)] px-2.5 text-xs font-semibold text-[var(--success)]">
              Review ready
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-[var(--border-subtle)] py-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-foreground/50">Quote</dt>
              <dd className="mt-1 font-semibold">1 credit</dd>
            </div>
            <div>
              <dt className="text-foreground/50">Rows</dt>
              <dd className="mt-1 font-semibold">42</dd>
            </div>
            <div>
              <dt className="text-foreground/50">Export</dt>
              <dd className="mt-1 font-semibold">XLSX, CSV</dd>
            </div>
            <div>
              <dt className="text-foreground/50">Deletes</dt>
              <dd className="mt-1 font-semibold">24 hours</dd>
            </div>
          </dl>

          <div className="mt-4 overflow-x-auto rounded-md border border-[var(--border-subtle)] bg-background">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-[var(--border-subtle)] text-xs uppercase tracking-[0.08em] text-foreground/45">
                <tr>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Description</th>
                  <th className="px-3 py-2 text-right font-semibold">Debit</th>
                  <th className="px-3 py-2 text-right font-semibold">Credit</th>
                  <th className="px-3 py-2 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {conversionRows.map((row) => (
                  <tr key={`${row[0]}:${row[1]}`}>
                    {row.map((cell, index) => (
                      <td
                        key={`${row[0]}:${row[1]}:${index}`}
                        className={`px-3 py-3 ${index >= 2 ? 'text-right' : ''}`}
                      >
                        {cell || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </aside>
      </section>

      <section className="border-y border-[var(--border-subtle)] bg-[var(--surface-muted)]">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-normal">Conversion path</h2>
          <ol className="mt-6 grid gap-4 lg:grid-cols-4">
            {workflow.map((step, index) => (
              <li key={step.label} className="border-t border-[var(--border-subtle)] pt-4">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/45">
                  0{index + 1}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{step.label}</h3>
                <p className="mt-2 text-sm leading-6 text-foreground/70">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[0.8fr_1fr] lg:px-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Evidence before claims</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/70">
            Trust copy stays close to product evidence: retention windows, request IDs, trace IDs,
            review status, security pages, and privacy routes. No compliance badge appears unless
            the underlying control is verified.
          </p>
        </div>
        <nav className="grid gap-3 sm:grid-cols-2" aria-label="Trust and privacy evidence routes">
          {trustLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="min-h-11 rounded-md border border-[var(--border-subtle)] px-4 py-3 text-sm font-medium hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </section>

      <section className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-normal">
            Bank statement conversion guides
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/70">
            Focused pages answer the format and document-quality questions people search before they
            upload financial documents.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            {relatedConversionLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-10 items-center rounded-md border border-[var(--border-subtle)] px-3 font-medium hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {link.href === '/bank-statement-to-excel'
                  ? 'convert bank statements to Excel'
                  : link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
