// Server-side Supabase clients.
// - getServiceRoleClient: bypasses RLS. Use only for trusted backend writes
//   (workspace bootstrap, Stripe webhook ingest, audit log writes).
// - getServerClient: per-request client wired to the user JWT. Enforces RLS.
//   Pulled from Authorization header or cookie context.

import 'server-only'

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { publicEnv, serverEnv, assertServerEnv } from '../shared/env'
import type { Database } from '../shared/db-types'

let cachedAdmin: SupabaseClient<Database> | null = null

export function getServiceRoleClient(): SupabaseClient<Database> {
  assertServerEnv(['SUPABASE_SERVICE_ROLE_KEY'])
  if (cachedAdmin) return cachedAdmin
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL
  const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase service role client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    )
  }
  cachedAdmin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedAdmin
}

export function getServerClient(accessToken?: string | null): SupabaseClient<Database> {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      'Supabase server client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
    )
  }
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  })
}

export async function pingSupabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = getServiceRoleClient()
    const { error } = await client.from('workspace').select('id').limit(0)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
