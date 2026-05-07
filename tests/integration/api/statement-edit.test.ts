import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from '@/app/api/v1/documents/[documentId]/statement/route'
import { applyStatementEdit } from '@/lib/server/statement-edit'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/server/statement-edit', () => ({
  applyStatementEdit: vi.fn(),
}))

const requireAuthenticatedUserMock = vi.mocked(requireAuthenticatedUser)
const applyStatementEditMock = vi.mocked(applyStatementEdit)

describe('documents statement edit route', () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123' } as never,
      },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns a stale revision conflict without applying transaction edits', async () => {
    applyStatementEditMock.mockResolvedValue({
      ok: false,
      status: 409,
      code: 'PRZM_STATEMENT_REVISION_CONFLICT',
      title: 'Statement changed',
      detail: 'Refresh the statement before editing.',
    })

    const response = await PATCH(
      jsonRequest({
        expectedRevision: 2,
        operations: [{ type: 'delete', id: 'txn_1' }],
      }) as never,
      routeParams('doc_123'),
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 409,
      code: 'PRZM_STATEMENT_REVISION_CONFLICT',
      detail: 'Refresh the statement before editing.',
    })
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(applyStatementEditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_123',
        actorUserId: 'user_123',
        expectedRevision: 2,
        operations: [{ type: 'delete', id: 'txn_1' }],
      }),
    )
  })
})

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/documents/doc_123/statement', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-request-id': 'req_statement' },
    body: JSON.stringify(body),
  })
}

function routeParams(documentId: string) {
  return {
    params: Promise.resolve({ documentId }),
  }
}
