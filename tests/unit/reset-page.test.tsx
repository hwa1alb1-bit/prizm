import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ResetPage from '@/app/(auth)/reset/page'
import { createClient } from '@/lib/client/supabase'

vi.mock('@/lib/client/supabase', () => ({
  createClient: vi.fn(),
}))

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const createClientMock = vi.mocked(createClient)
const getUser = vi.fn()
const updateUser = vi.fn()

describe('ResetPage', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/reset')
    getUser.mockResolvedValue({ data: { user: { id: 'u', email: 'owner@example.com' } }, error: null })
    updateUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    createClientMock.mockReturnValue({
      auth: { getUser, updateUser },
    } as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
    push.mockReset()
  })

  it('renders a new-password form when the recovery session is active', async () => {
    render(<ResetPage />)
    expect(
      await screen.findByRole('heading', { level: 1, name: /Choose a new password/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/New password/i)).toBeInTheDocument()
    expect(screen.getByText(/10\+ characters/i)).toBeInTheDocument()
  })

  it('updates the password and redirects to /app on success', async () => {
    render(<ResetPage />)
    await userEvent.type(await screen.findByLabelText(/New password/i), 'Hunter12345')
    await userEvent.click(screen.getByRole('button', { name: /Update password/i }))

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ password: 'Hunter12345' })
    })
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/app')
    })
  })

  it('blocks update when the password fails the policy', async () => {
    render(<ResetPage />)
    await userEvent.type(await screen.findByLabelText(/New password/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /Update password/i }))

    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('shows an expired-link state when no recovery session is present', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    render(<ResetPage />)

    expect(
      await screen.findByRole('heading', { name: /Reset link expired/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Request a new reset link/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('surfaces Supabase errors on update', async () => {
    updateUser.mockResolvedValueOnce({
      data: null,
      error: { message: 'New password must be different' },
    })
    render(<ResetPage />)
    await userEvent.type(await screen.findByLabelText(/New password/i), 'Hunter12345')
    await userEvent.click(screen.getByRole('button', { name: /Update password/i }))

    expect(await screen.findByText(/New password must be different/i)).toBeInTheDocument()
  })
})
