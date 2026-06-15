import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { UploadHero } from '@/components/marketing/upload-hero'

function dropzone(): HTMLElement {
  return screen.getByRole('button', { name: /Upload PDF statement/i })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('UploadHero state machine', () => {
  it('defaults to the idle state', () => {
    render(<UploadHero isAuthenticated={false} />)
    expect(dropzone()).toHaveAttribute('data-status', 'idle')
    expect(screen.getByText(/Drag and drop your PDF statement here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Choose PDF/i })).toBeEnabled()
  })

  it('renders dragover with the swapped headline', () => {
    render(<UploadHero isAuthenticated={false} initialStatus={{ kind: 'dragover' }} />)
    expect(dropzone()).toHaveAttribute('data-status', 'dragover')
    expect(screen.getByText(/Drop your PDF to start conversion/i)).toBeInTheDocument()
  })

  it('renders uploading with a progress indicator and no Choose PDF cta', () => {
    render(
      <UploadHero
        isAuthenticated={false}
        initialStatus={{
          kind: 'uploading',
          progress: 42,
          filename: 'q1.pdf',
          sizeLabel: '2.1 MB',
        }}
      />,
    )
    expect(dropzone()).toHaveAttribute('data-status', 'uploading')
    expect(within(dropzone()).getByText(/Uploading…/i)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
    expect(screen.queryByRole('button', { name: /Choose PDF/i })).toBeNull()
  })

  it('renders processing with the extraction status copy', () => {
    render(
      <UploadHero
        isAuthenticated={false}
        initialStatus={{ kind: 'processing', filename: 'q1.pdf', sizeLabel: '2.1 MB' }}
      />,
    )
    expect(dropzone()).toHaveAttribute('data-status', 'processing')
    expect(within(dropzone()).getByText(/Extracting data…/i)).toBeInTheDocument()
  })

  it('renders success with a view result link', () => {
    render(
      <UploadHero
        isAuthenticated={true}
        initialStatus={{
          kind: 'success',
          filename: 'q1.pdf',
          sizeLabel: '2.1 MB',
          rows: 128,
        }}
      />,
    )
    expect(dropzone()).toHaveAttribute('data-status', 'success')
    expect(screen.getByText(/128 rows/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View result/i })).toHaveAttribute('href', '/app')
  })

  it('renders error with the message and a try-again button', () => {
    render(
      <UploadHero
        isAuthenticated={false}
        initialStatus={{ kind: 'error', message: 'Network interrupted.' }}
      />,
    )
    expect(dropzone()).toHaveAttribute('data-status', 'error')
    expect(screen.getByText('Network interrupted.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()
  })

  it('renders the disabled state without an enabled CTA', () => {
    render(<UploadHero isAuthenticated={false} initialStatus={{ kind: 'disabled' }} />)
    expect(dropzone()).toHaveAttribute('data-status', 'disabled')
    expect(screen.getByText(/Uploads paused/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Choose PDF/i })).toBeDisabled()
  })

  it('resets to idle when Try again is clicked from the error state', () => {
    render(
      <UploadHero
        isAuthenticated={false}
        initialStatus={{ kind: 'error', message: 'Network interrupted.' }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }))
    expect(dropzone()).toHaveAttribute('data-status', 'idle')
  })
})
