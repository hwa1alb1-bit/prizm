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

    const workspace = await client.from('workspace').select('id').limit(0)
    if (workspace.error) return { ok: false, error: workspace.error.message }

    const documentSchema = await client
      .from('document')
      .select('id, storage_provider, storage_bucket, storage_key')
      .limit(0)
    if (documentSchema.error) {
      return {
        ok: false,
        error: `document upload schema not ready: ${documentSchema.error.message}`,
      }
    }

    // Invalid provider proves the current RPC signature without allowing an insert.
    const uploadRpc = await client.rpc('create_pending_document_upload_for_actor', {
      p_actor_user_id: '00000000-0000-0000-0000-000000000000',
      p_filename: 'schema-probe.pdf',
      p_content_type: 'application/pdf',
      p_size_bytes: 1,
      p_s3_bucket: 'schema-probe',
      p_s3_key: 'schema-probe.pdf',
      p_expires_at: new Date(Date.now() + 60_000).toISOString(),
      p_request_id: 'supabase-health-schema-probe',
      p_trace_id: 'supabasehealthschemaprobe0001',
      p_actor_ip: null,
      p_actor_user_agent: 'prizm-health-schema-probe',
      p_file_sha256: 'a'.repeat(64),
      p_conversion_cost_credits: 1,
      p_storage_provider: '__schema_probe__',
      p_storage_bucket: 'schema-probe',
      p_storage_key: 'schema-probe.pdf',
    })
    if (!uploadRpc.error) {
      return {
        ok: false,
        error: 'document upload RPC probe unexpectedly succeeded',
      }
    }

    if (uploadRpc.error.message !== 'invalid_storage_provider') {
      return {
        ok: false,
        error: `document upload RPC not ready: ${uploadRpc.error.message}`,
      }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
