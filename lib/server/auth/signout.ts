import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/shared/db-types'
import { publicEnv } from '@/lib/shared/env'

export type SignOutResult = { ok: true } | { ok: false; reason: string }

export async function signOutFromCookies(): Promise<SignOutResult> {
  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, reason: 'auth_not_configured' }
  }

  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Server Components cannot mutate cookies. Route handlers can.
        }
      },
    },
  })

  const { error } = await supabase.auth.signOut()
  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}
