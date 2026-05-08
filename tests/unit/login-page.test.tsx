import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '@/app/(auth)/login/page'
import { createClient } from '@/lib/client/supabase'

vi.mock('@/lib/client/supabase', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const signInWithOtp = vi.fn()

describe('LoginPage', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://prizmview.app'
    window.history.pushState({}, '', '/login?next=%2Fapp%2Fbilling')
    signInWithOtp.mockResolvedValue({ error: null })
    createClientMock.mockReturnValue({
      auth: {
        signInWithOtp,
      },
    } as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/')
  })

  it('preserves the requested app route in the magic-link callback', async () => {
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText('Email'), 'owner@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    await waitFor(() => {
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: 'owner@example.com',
        options: {
          emailRedirectTo: 'https://prizmview.app/auth/callback?next=%2Fapp%2Fbilling',
        },
      })
    })
  })
})
