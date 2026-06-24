import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkflowStepsRail } from '@/components/marketing/workflow-steps-rail'

describe('WorkflowStepsRail', () => {
  it('renders the workflow heading', () => {
    render(<WorkflowStepsRail />)
    expect(
      screen.getByRole('heading', { level: 3, name: /From PDF to clean spreadsheet/i }),
    ).toBeInTheDocument()
  })

  it('renders four numbered steps in order', () => {
    render(<WorkflowStepsRail />)
    const list = screen.getByRole('list')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    const titles = [
      'Securely upload your PDF',
      'We extract the data',
      'Review and verify',
      'Export clean files',
    ]
    titles.forEach((title, index) => {
      expect(items[index]).toHaveTextContent(title)
    })
  })

  it('does not name a TLS version in the upload step body', () => {
    render(<WorkflowStepsRail />)
    expect(screen.queryByText(/TLS 1\.2/)).toBeNull()
  })
})
