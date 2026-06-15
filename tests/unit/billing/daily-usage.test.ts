import { describe, expect, it, vi } from 'vitest'
import { getDailyUsage, incrementDailyUsage, todayInUtc } from '@/lib/server/billing/daily-usage'

function maybeSingleMock(payload: {
  data: { pages_used: number } | null
  error: null | { message: string }
}) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(payload),
          }),
        }),
      }),
    }),
  }
}

describe('getDailyUsage', () => {
  it('returns 0 when no row exists for the user on that date', async () => {
    const supabase = maybeSingleMock({ data: null, error: null })

    const result = await getDailyUsage({
      supabase: supabase as never,
      userId: 'user_1',
      date: '2026-06-15',
    })

    expect(result).toEqual({ ok: true, pagesUsed: 0 })
    expect(supabase.from).toHaveBeenCalledWith('daily_usage')
  })

  it('returns the persisted pages_used count when a row exists', async () => {
    const supabase = maybeSingleMock({ data: { pages_used: 3 }, error: null })

    const result = await getDailyUsage({
      supabase: supabase as never,
      userId: 'user_1',
      date: '2026-06-15',
    })

    expect(result).toEqual({ ok: true, pagesUsed: 3 })
  })

  it('returns an error when the select fails', async () => {
    const supabase = maybeSingleMock({ data: null, error: { message: 'rls' } })

    const result = await getDailyUsage({
      supabase: supabase as never,
      userId: 'user_1',
      date: '2026-06-15',
    })

    expect(result).toEqual({ ok: false, reason: 'rls' })
  })
})

describe('incrementDailyUsage', () => {
  it('calls the increment_daily_usage RPC with the user, date, and page delta', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 4, error: null })

    const result = await incrementDailyUsage({
      supabase: { rpc } as never,
      userId: 'user_1',
      date: '2026-06-15',
      pages: 3,
    })

    expect(rpc).toHaveBeenCalledWith('increment_daily_usage', {
      p_user_id: 'user_1',
      p_usage_date: '2026-06-15',
      p_pages: 3,
    })
    expect(result).toEqual({ ok: true, pagesUsed: 4 })
  })

  it('returns an error when the RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })

    const result = await incrementDailyUsage({
      supabase: { rpc } as never,
      userId: 'user_1',
      date: '2026-06-15',
      pages: 1,
    })

    expect(result).toEqual({ ok: false, reason: 'boom' })
  })

  it('rejects non-positive page deltas before hitting the database', async () => {
    const rpc = vi.fn()

    const result = await incrementDailyUsage({
      supabase: { rpc } as never,
      userId: 'user_1',
      date: '2026-06-15',
      pages: 0,
    })

    expect(result).toEqual({ ok: false, reason: 'invalid_pages' })
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('todayInUtc', () => {
  it('returns an ISO date string for the current UTC day', () => {
    const value = todayInUtc()
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('honors an injected reference date', () => {
    const ref = new Date('2026-06-15T23:59:59Z')
    expect(todayInUtc(ref)).toBe('2026-06-15')
  })

  it('rolls to the next UTC date at midnight UTC', () => {
    const ref = new Date('2026-06-16T00:00:00Z')
    expect(todayInUtc(ref)).toBe('2026-06-16')
  })
})
