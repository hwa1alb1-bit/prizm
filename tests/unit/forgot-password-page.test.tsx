import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page'
import { createClient } from '@/lib/client/supabase'

vi.mock('@/lib/client/supabase', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const resetPasswordForEmail = vi.fn()

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://pdftoexcelstatementconverter.com'
    window.history.pushState({}, '', '/forgot-password')
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    createClientMock.mockReturnValue({
      auth: { resetPasswordForEmail },
    } as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/')
  })

  it('renders an email form for the reset request', () => {
    render(<ForgotPasswordPage />)
    expect(
      screen.getByRole('heading', { level: 1, name: /Reset your password/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument()
    expect(screen.getByText(/we'll send a reset link/i)).toBeInTheDocument()
  })

  it('calls resetPasswordForEmail with a redirect URL that lands on /reset', async () => {
    render(<ForgotPasswordPage />)
    await userEvent.type(screen.getByLabelText(/^Email$/i), 'owner@example.com')
    await userEvent.click(screen.getByRole('button', { name: /Send reset link/i }))

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith('owner@example.com', {
        redirectTo: 'https://pdftoexcelstatementconverter.com/auth/callback?next=%2Freset',
      })
    })

    expect(await screen.findByRole('heading', { name: /Check your inbox/i })).toBeInTheDocument()
    expect(screen.getByText('owner@example.com')).toBeInTheDocument()
  })

  it('adapts the lede when ?firstTime=1 is present', () => {
    window.history.pushState({}, '', '/forgot-password?firstTime=1')
    render(<ForgotPasswordPage />)
    expect(screen.getByText(/finish your account setup/i)).toBeInTheDocument()
  })

  it('surfaces Supabase errors', async () => {
    resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: { message: 'Email rate limit exceeded' },
    })
    render(<ForgotPasswordPage />)
    await userEvent.type(screen.getByLabelText(/^Email$/i), 'owner@example.com')
    await userEvent.click(screen.getByRole('button', { name: /Send reset link/i }))

    expect(await screen.findByText(/Email rate limit exceeded/i)).toBeInTheDocument()
  })
})
