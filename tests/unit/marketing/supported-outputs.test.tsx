import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SupportedOutputs } from '@/components/marketing/supported-outputs'

describe('SupportedOutputs', () => {
  it('lists all four export formats from the product surface', () => {
    render(<SupportedOutputs />)
    expect(
      screen.getByRole('heading', { level: 3, name: /Supported outputs/i }),
    ).toBeInTheDocument()
    for (const format of ['CSV', 'Excel (XLSX)', 'QuickBooks CSV', 'Xero CSV']) {
      expect(screen.getByText(format)).toBeInTheDocument()
    }
  })
})
