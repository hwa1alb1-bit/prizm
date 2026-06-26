import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExportActions, type ExportActionItem } from '@/components/app/export-actions'

const { fetchMock, refresh } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

const actions: ExportActionItem[] = [
  { format: 'csv' },
  { format: 'xlsx' },
  { format: 'quickbooks_csv' },
  { format: 'xero_csv' },
]

beforeEach(() => {
  refresh.mockClear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function exportResponse(): Response {
  return new Response('date,amount\n2026-01-01,10', {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'content-disposition': 'attachment; filename="statement.csv"',
    },
  })
}

describe('ExportActions', () => {
  it('renders one button per supported export format', () => {
    render(<ExportActions documentId="doc_ready" actions={actions} />)

    expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excel (XLSX)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'QuickBooks CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xero CSV' })).toBeInTheDocument()
  })

  it.each([
    ['QuickBooks CSV', 'quickbooks_csv', 'statement.quickbooks-csv'],
    ['Xero CSV', 'xero_csv', 'statement.xero-csv'],
  ])(
    'requests %s using the matching format query and downloads with the server-provided filename',
    async (label, format, filename) => {
      fetchMock.mockResolvedValue(
        new Response('date,amount\n2026-01-01,10', {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'content-disposition': `attachment; filename="${filename}"`,
          },
        }),
      )
      const user = userEvent.setup()

      render(<ExportActions documentId="doc_ready" actions={actions} />)

      await user.click(screen.getByRole('button', { name: label }))

      expect(fetchMock).toHaveBeenCalledWith(`/api/v1/documents/doc_ready/export?format=${format}`)
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
      expect(screen.getByRole('status')).toHaveTextContent(/export downloaded\.$/)
    },
  )

  it('downloads the export then refreshes so the timeline can flip to complete', async () => {
    fetchMock.mockResolvedValue(exportResponse())
    const user = userEvent.setup()

    render(<ExportActions documentId="doc_ready" actions={actions} />)

    await user.click(screen.getByRole('button', { name: 'CSV' }))

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/documents/doc_ready/export?format=csv')
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('status')).toHaveTextContent(/export downloaded\.$/)
  })

  it('surfaces a recoverable error and does not refresh when the export fails', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }))
    const user = userEvent.setup()

    render(<ExportActions documentId="doc_ready" actions={actions} />)

    await user.click(screen.getByRole('button', { name: 'Excel (XLSX)' }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Export could not be prepared. Try again.',
      ),
    )
    expect(refresh).not.toHaveBeenCalled()
  })
})
