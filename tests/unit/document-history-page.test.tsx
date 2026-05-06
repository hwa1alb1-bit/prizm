import { afterEach, describe, expect, it, vi } from 'vitest'
import HistoryPage from '@/app/(dashboard)/app/history/page'
import { loadDocumentHistoryForCurrentUser } from '@/lib/server/document-history'
import { redirect } from 'next/navigation'

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`)
  }),
  loadDocumentHistoryForCurrentUser: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('@/lib/server/document-history', () => ({
  loadDocumentHistoryForCurrentUser: mocks.loadDocumentHistoryForCurrentUser,
}))

const loadDocumentHistoryForCurrentUserMock = vi.mocked(loadDocumentHistoryForCurrentUser)
const redirectMock = vi.mocked(redirect)

describe('HistoryPage auth', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthenticated users to login with the history return path', async () => {
    loadDocumentHistoryForCurrentUserMock.mockResolvedValue({
      ok: false,
      reason: 'unauthenticated',
      title: 'Authentication required',
      detail: 'Sign in to view statement history.',
    })

    await expect(HistoryPage()).rejects.toThrow('redirect:/login?next=%2Fapp%2Fhistory')
    expect(redirectMock).toHaveBeenCalledWith('/login?next=%2Fapp%2Fhistory')
  })

  it('preserves the active queue filter in the login return path', async () => {
    loadDocumentHistoryForCurrentUserMock.mockResolvedValue({
      ok: false,
      reason: 'unauthenticated',
      title: 'Authentication required',
      detail: 'Sign in to view statement history.',
    })

    await expect(
      HistoryPage({ searchParams: Promise.resolve({ status: 'failed' }) }),
    ).rejects.toThrow('redirect:/login?next=%2Fapp%2Fhistory%3Fstatus%3Dfailed')
    expect(redirectMock).toHaveBeenCalledWith('/login?next=%2Fapp%2Fhistory%3Fstatus%3Dfailed')
  })
})
