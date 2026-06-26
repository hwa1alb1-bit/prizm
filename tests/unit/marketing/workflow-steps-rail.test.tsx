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

  it('exposes the workflow as a discoverable landmark region', () => {
    render(<WorkflowStepsRail />)
    expect(screen.getByRole('region', { name: /workflow/i })).toBeInTheDocument()
  })

  it('renders numeric badges 1 through 4 inline with each step', () => {
    render(<WorkflowStepsRail />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(4)
    items.forEach((item, index) => {
      expect(item.textContent).toContain(String(index + 1))
    })
  })

  it('does not paint the step numerals with a decorative gradient (DESIGN.md Rare Accent Rule)', () => {
    const { container } = render(<WorkflowStepsRail />)
    const html = container.innerHTML
    expect(html).not.toMatch(/radial-gradient|linear-gradient/i)
  })
})
