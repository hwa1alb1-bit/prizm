import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/db-types'

export type ChangeAccountPasswordInput = {
  supabase: SupabaseClient<Database>
  email: string
  currentPassword: string
  newPassword: string
}

export type ChangeAccountPasswordResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_current' | string }

export async function changeAccountPassword({
  supabase,
  email,
  currentPassword,
  newPassword,
}: ChangeAccountPasswordInput): Promise<ChangeAccountPasswordResult> {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })
  if (signInError) return { ok: false, reason: 'invalid_current' }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) return { ok: false, reason: updateError.message }
  return { ok: true }
}
