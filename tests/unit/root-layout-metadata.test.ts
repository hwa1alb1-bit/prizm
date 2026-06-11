import { describe, expect, it, vi } from 'vitest'

vi.mock('next/font/google', () => {
  const fontFactory = () => ({ variable: '--mocked-font', className: 'mocked-font' })
  return { Geist_Mono: fontFactory, Montserrat: fontFactory }
})

const { metadata } = await import('@/app/layout')

describe('Root layout metadata', () => {
  it('uses the StatementStudio brand on applicationName and title', () => {
    expect(metadata.applicationName).toBe('StatementStudio')

    const title = metadata.title
    if (!title || typeof title === 'string') {
      throw new Error('Expected title to be a TemplateString')
    }
    const templated = title as { default: string; template: string }
    expect(templated.default).toContain('StatementStudio')
    expect(templated.template).toContain('StatementStudio')
    expect(templated.default).not.toMatch(/PrizmView/)
    expect(templated.template).not.toMatch(/PrizmView/)
  })

  it('uses the mockup-aligned description and matching OG/Twitter copy', () => {
    expect(metadata.description).toMatch(
      /Convert bank, credit card, and financial statements into clean transaction files/,
    )
    expect(metadata.description).toMatch(/QuickBooks, Xero, CSV, and Excel/)
    expect(metadata.openGraph?.siteName).toBe('StatementStudio')
    expect(metadata.openGraph?.title).not.toMatch(/PrizmView/)
    expect((metadata.twitter as { title?: string } | undefined)?.title).not.toMatch(/PrizmView/)
  })
})
