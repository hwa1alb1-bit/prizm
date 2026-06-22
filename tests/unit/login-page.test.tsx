import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '@/app/(auth)/login/page'
import { createClient } from '@/lib/client/supabase'

vi.mock('@/lib/client/supabase', () => ({
  createClient: vi.fn(),
}))

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const createClientMock = vi.mocked(createClient)
const signInWithPassword = vi.fn()

describe('LoginPage', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://pdftoexcelstatementconverter.com'
    window.history.pushState({}, '', '/login')
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    createClientMock.mockReturnValue({
      auth: { signInWithPassword },
    } as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/')
    push.mockReset()
  })

  it('renders an email + password sign-in form with a forgot-password link', () => {
    render(<LoginPage />)
    expect(
      screen.getByRole('heading', { level: 1, name: /Sign in to StatementStudio/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Forgot password\?/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('signs the user in with email + password and redirects to /app on success', async () => {
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText(/^Email$/i), 'owner@example.com')
    await userEvent.type(screen.getByLabelText(/^Password$/i), 'Hunter12345')
    await userEvent.click(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'owner@example.com',
        password: 'Hunter12345',
      })
    })
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/app')
    })
  })

  it('honors the next query parameter on a successful login', async () => {
    window.history.pushState({}, '', '/login?next=%2Fapp%2Fbilling')
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText(/^Email$/i), 'owner@example.com')
    await userEvent.type(screen.getByLabelText(/^Password$/i), 'Hunter12345')
    await userEvent.click(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/app/billing')
    })
  })

  it('surfaces the Supabase error on bad credentials', async () => {
    signInWithPassword.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid login credentials' },
    })
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText(/^Email$/i), 'owner@example.com')
    await userEvent.type(screen.getByLabelText(/^Password$/i), 'wrongpassword')
    await userEvent.click(screen.getByRole('button', { name: /Sign in/i }))

    expect(await screen.findByText(/Invalid login credentials/i)).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('offers an affordance for first-time password setup', () => {
    render(<LoginPage />)
    const link = screen.getByRole('link', { name: /Set your password/i })
    expect(link).toHaveAttribute('href', '/forgot-password?firstTime=1')
  })
})
