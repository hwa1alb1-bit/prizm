import { describe, expect, it, vi } from 'vitest'
import { debitFreePlanPagesForDocument } from '@/lib/server/billing/daily-usage'

describe('debitFreePlanPagesForDocument', () => {
  it('calls the debit_free_plan_pages_for_document RPC with the document, user, date, and pages', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 5, error: null })

    const result = await debitFreePlanPagesForDocument({
      supabase: { rpc } as never,
      documentId: 'doc_123',
      userId: 'user_1',
      date: '2026-06-16',
      pages: 3,
    })

    expect(rpc).toHaveBeenCalledWith('debit_free_plan_pages_for_document', {
      p_document_id: 'doc_123',
      p_user_id: 'user_1',
      p_usage_date: '2026-06-16',
      p_pages: 3,
    })
    expect(result).toEqual({ ok: true, pagesUsed: 5 })
  })

  it('returns pagesUsed: null when the RPC reports the document was already debited', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })

    const result = await debitFreePlanPagesForDocument({
      supabase: { rpc } as never,
      documentId: 'doc_123',
      userId: 'user_1',
      date: '2026-06-16',
      pages: 3,
    })

    expect(result).toEqual({ ok: true, pagesUsed: null })
  })

  it('rejects non-positive page deltas before hitting the database', async () => {
    const rpc = vi.fn()

    const result = await debitFreePlanPagesForDocument({
      supabase: { rpc } as never,
      documentId: 'doc_123',
      userId: 'user_1',
      date: '2026-06-16',
      pages: 0,
    })

    expect(result).toEqual({ ok: false, reason: 'invalid_pages' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('surfaces the RPC error message when the call fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'rls_denied' } })

    const result = await debitFreePlanPagesForDocument({
      supabase: { rpc } as never,
      documentId: 'doc_123',
      userId: 'user_1',
      date: '2026-06-16',
      pages: 2,
    })

    expect(result).toEqual({ ok: false, reason: 'rls_denied' })
  })
})
