import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/db-types'

export type UpdateUserProfileInput = {
  supabase: SupabaseClient<Database>
  userId: string
  fullName: string
}

export type UpdateUserProfileResult = { ok: true } | { ok: false; reason: string }

export async function updateUserProfile({
  supabase,
  userId,
  fullName,
}: UpdateUserProfileInput): Promise<UpdateUserProfileResult> {
  const { error } = await supabase
    .from('user_profile')
    .update({ full_name: fullName })
    .eq('id', userId)

  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}
