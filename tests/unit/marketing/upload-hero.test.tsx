import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}))

import { UploadHero } from '@/components/marketing/upload-hero'

afterEach(() => {
  pushMock.mockReset()
})

function findFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]')
  if (!input) throw new Error('No file input rendered')
  return input as HTMLInputElement
}

function pickFile() {
  const file = new File(['%PDF-1.4 sample'], 'statement.pdf', { type: 'application/pdf' })
  fireEvent.change(findFileInput(), { target: { files: [file] } })
}

describe('UploadHero', () => {
  it('renders the eyebrow chip and headline', () => {
    render(<UploadHero isAuthenticated={false} />)
    expect(screen.getByText(/BANK & CREDIT CARD STATEMENT CONVERTER/)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Turn PDF Statements into QuickBooks and Xero.*Ready Files/i,
      }),
    ).toBeInTheDocument()
  })

  it('renders the four supported export formats inline', () => {
    render(<UploadHero isAuthenticated={false} />)
    const formats = screen.getByRole('list', { name: /Supported export formats/i })
    expect(within(formats).getByText('CSV')).toBeInTheDocument()
    expect(within(formats).getByText('Excel (XLSX)')).toBeInTheDocument()
    expect(within(formats).getByText('QuickBooks CSV')).toBeInTheDocument()
    expect(within(formats).getByText('Xero CSV')).toBeInTheDocument()
  })

  it('renders an accessible dropzone with file input', () => {
    render(<UploadHero isAuthenticated={false} />)
    const dropzone = screen.getByRole('button', { name: /Upload PDF statement/i })
    expect(dropzone).toBeInTheDocument()
    expect(within(dropzone).getByRole('button', { name: /Choose PDF/i })).toBeInTheDocument()
    expect(findFileInput()).toBeInTheDocument()
  })

  it('renders the idle Conversion status card', () => {
    render(<UploadHero isAuthenticated={false} />)
    expect(screen.getByText(/Conversion status/i)).toBeInTheDocument()
    expect(screen.getByText(/Waiting for upload/i)).toBeInTheDocument()
    expect(screen.getByText(/No file uploaded/i)).toBeInTheDocument()
  })

  it('routes anonymous users to /register?next=/app on file selection', () => {
    render(<UploadHero isAuthenticated={false} />)
    pickFile()
    expect(pushMock).toHaveBeenCalledWith('/register?next=/app')
  })

  it('routes signed-in users to /app on file selection', () => {
    render(<UploadHero isAuthenticated={true} />)
    pickFile()
    expect(pushMock).toHaveBeenCalledWith('/app')
  })

  it('stashes the picked file and a sessionStorage marker for the upload page to pick up', async () => {
    sessionStorage.removeItem('ss:pending-upload')
    render(<UploadHero isAuthenticated={true} />)
    pickFile()

    const { takePendingUpload } = await import('@/components/marketing/upload-hero')
    expect(sessionStorage.getItem('ss:pending-upload')).toBe('1')
    const pending = takePendingUpload()
    expect(pending).toBeInstanceOf(File)
    expect(pending?.name).toBe('statement.pdf')
    expect(sessionStorage.getItem('ss:pending-upload')).toBeNull()
  })
})
