import { afterEach, describe, expect, it, vi } from 'vitest'
import DocumentReviewPage from '@/app/(dashboard)/app/history/[documentId]/page'
import { loadDocumentReviewForCurrentUser } from '@/lib/server/document-history'
import { redirect } from 'next/navigation'

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found')
  }),
  loadDocumentReviewForCurrentUser: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}))

vi.mock('@/lib/server/document-history', () => ({
  loadDocumentReviewForCurrentUser: mocks.loadDocumentReviewForCurrentUser,
}))

const loadDocumentReviewForCurrentUserMock = vi.mocked(loadDocumentReviewForCurrentUser)
const redirectMock = vi.mocked(redirect)

describe('DocumentReviewPage auth', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthenticated users to login with the review return path', async () => {
    loadDocumentReviewForCurrentUserMock.mockResolvedValue({
      ok: false,
      reason: 'unauthenticated',
      title: 'Authentication required',
      detail: 'Sign in to view statement history.',
    })

    await expect(
      DocumentReviewPage({ params: Promise.resolve({ documentId: 'doc_123' }) }),
    ).rejects.toThrow('redirect:/login?next=%2Fapp%2Fhistory%2Fdoc_123')
    expect(redirectMock).toHaveBeenCalledWith('/login?next=%2Fapp%2Fhistory%2Fdoc_123')
  })
})
