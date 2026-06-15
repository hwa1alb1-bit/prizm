import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/db-types'

export const FREE_DAILY_PAGE_LIMIT = 5

export type DailyUsageInput = {
  supabase: SupabaseClient<Database>
  userId: string
  date: string
}

export type DailyUsageResult = { ok: true; pagesUsed: number } | { ok: false; reason: string }

export async function getDailyUsage({
  supabase,
  userId,
  date,
}: DailyUsageInput): Promise<DailyUsageResult> {
  const { data, error } = await supabase
    .from('daily_usage')
    .select('pages_used')
    .eq('user_id', userId)
    .eq('usage_date', date)
    .maybeSingle()

  if (error) return { ok: false, reason: error.message }
  return { ok: true, pagesUsed: data?.pages_used ?? 0 }
}

export type IncrementDailyUsageInput = DailyUsageInput & { pages: number }

export async function incrementDailyUsage({
  supabase,
  userId,
  date,
  pages,
}: IncrementDailyUsageInput): Promise<DailyUsageResult> {
  if (!Number.isInteger(pages) || pages <= 0) {
    return { ok: false, reason: 'invalid_pages' }
  }

  const { data, error } = await supabase.rpc('increment_daily_usage', {
    p_user_id: userId,
    p_usage_date: date,
    p_pages: pages,
  })

  if (error) return { ok: false, reason: error.message }
  return { ok: true, pagesUsed: data as number }
}

export function todayInUtc(reference: Date = new Date()): string {
  const year = reference.getUTCFullYear()
  const month = String(reference.getUTCMonth() + 1).padStart(2, '0')
  const day = String(reference.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function nextMidnightUtc(reference: Date = new Date()): Date {
  const next = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      reference.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  )
  return next
}
