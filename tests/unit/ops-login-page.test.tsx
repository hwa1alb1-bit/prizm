import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OpsLoginPage from '@/app/ops/login/page'
import { createClient } from '@/lib/client/supabase'

vi.mock('@/lib/client/supabase', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const signInWithOtp = vi.fn()

describe('OpsLoginPage', () => {
  beforeEach(() => {
    signInWithOtp.mockResolvedValue({ error: null })
    createClientMock.mockReturnValue({
      auth: { signInWithOtp },
    } as never)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
      }),
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('requests an ops login link through the server route', async () => {
    render(<OpsLoginPage />)

    await userEvent.type(screen.getByLabelText('Email'), 'oneoddbob@gmail.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send admin link' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/ops/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'oneoddbob@gmail.com' }),
      })
    })
    expect(signInWithOtp).not.toHaveBeenCalled()
  })
})
