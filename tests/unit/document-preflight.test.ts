import { describe, expect, it, vi } from 'vitest'
import {
  preflightDocumentUpload,
  type DocumentPreflightDependencies,
} from '@/lib/server/document-preflight'

describe('preflightDocumentUpload', () => {
  it('returns the active duplicate document and disables conversion', async () => {
    const deps = createDependencies()
    deps.findActiveDuplicate.mockResolvedValueOnce({ id: 'doc_existing' })

    const result = await preflightDocumentUpload(preflightInput(), deps)

    expect(result).toEqual({
      ok: true,
      quote: { costCredits: 1 },
      currentBalance: 5,
      canConvert: false,
      duplicate: { isDuplicate: true, existingDocumentId: 'doc_existing' },
      requestId: 'req_preflight',
      traceId: '0123456789abcdef0123456789abcdef',
    })
    expect(deps.findActiveDuplicate).toHaveBeenCalledWith({
      workspaceId: 'workspace_123',
      fileSha256: 'a'.repeat(64),
      nowIso: '2026-05-06T00:00:00.000Z',
    })
  })
})

function preflightInput() {
  return {
    actorUserId: 'user_123',
    filename: 'statement.pdf',
    contentType: 'application/pdf' as const,
    sizeBytes: 4096,
    fileSha256: 'a'.repeat(64),
    routeContext: {
      requestId: 'req_preflight',
      traceId: '0123456789abcdef0123456789abcdef',
      pathname: '/api/v1/documents/preflight',
    },
  }
}

function createDependencies() {
  const deps = {
    getUserProfile: vi.fn().mockResolvedValue({
      workspaceId: 'workspace_123',
      role: 'member',
    }),
    getCurrentCreditBalance: vi.fn().mockResolvedValue(5),
    findActiveDuplicate: vi.fn().mockResolvedValue(null),
    now: vi.fn(() => new Date('2026-05-06T00:00:00.000Z')),
  } satisfies DocumentPreflightDependencies
  return deps
}
