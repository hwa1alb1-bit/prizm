import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/db-types'

export type RequestEmailChangeInput = {
  supabase: SupabaseClient<Database>
  email: string
}

export type RequestEmailChangeResult = { ok: true } | { ok: false; reason: string }

export async function requestEmailChange({
  supabase,
  email,
}: RequestEmailChangeInput): Promise<RequestEmailChangeResult> {
  const { error } = await supabase.auth.updateUser({ email })
  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}
