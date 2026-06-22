import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterPage from '@/app/(auth)/register/page'
import { createClient } from '@/lib/client/supabase'

vi.mock('@/lib/client/supabase', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const signUp = vi.fn()

describe('RegisterPage', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://pdftoexcelstatementconverter.com'
    window.history.pushState({}, '', '/register')
    signUp.mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null })
    createClientMock.mockReturnValue({
      auth: {
        signUp,
      },
    } as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/')
  })

  it('renders an email + password form and a password hint', () => {
    render(<RegisterPage />)
    expect(
      screen.getByRole('heading', { level: 1, name: /Create your StatementStudio account/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Work email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument()
    expect(screen.getByText(/10\+ characters/i)).toBeInTheDocument()
  })

  it('signs up with email + password and shows the verify-email confirmation', async () => {
    render(<RegisterPage />)
    await userEvent.type(screen.getByLabelText(/Work email/i), 'owner@example.com')
    await userEvent.type(screen.getByLabelText(/^Password$/i), 'Hunter12345')
    await userEvent.click(screen.getByRole('button', { name: /Create account/i }))

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        email: 'owner@example.com',
        password: 'Hunter12345',
        options: {
          emailRedirectTo: 'https://pdftoexcelstatementconverter.com/auth/callback',
        },
      })
    })

    expect(await screen.findByText(/Check your email/i)).toBeInTheDocument()
    expect(screen.getByText('owner@example.com')).toBeInTheDocument()
  })

  it('blocks signup when the password fails the policy', async () => {
    render(<RegisterPage />)
    await userEvent.type(screen.getByLabelText(/Work email/i), 'owner@example.com')
    await userEvent.type(screen.getByLabelText(/^Password$/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /Create account/i }))

    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('surfaces the Supabase error when signup fails', async () => {
    signUp.mockResolvedValueOnce({ data: null, error: { message: 'Email already registered' } })
    render(<RegisterPage />)
    await userEvent.type(screen.getByLabelText(/Work email/i), 'owner@example.com')
    await userEvent.type(screen.getByLabelText(/^Password$/i), 'Hunter12345')
    await userEvent.click(screen.getByRole('button', { name: /Create account/i }))

    expect(await screen.findByText(/Email already registered/i)).toBeInTheDocument()
  })
})
