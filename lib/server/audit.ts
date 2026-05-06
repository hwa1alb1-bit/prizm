// Audit event recorder. Writes to public.audit_event using the service-role
// client to ensure events land even when the request lacks an authenticated user
// (e.g. webhook-triggered side effects, cron-driven sweeps).

import 'server-only'

import { getServiceRoleClient } from './supabase'
import type { Json } from '../shared/db-types'

export type AuditEventInput = {
  eventType: string
  workspaceId?: string | null
  actorUserId?: string | null
  targetType?: string | null
  targetId?: string | null
  metadata?: Json | null
  actorIp?: string | null
  actorUserAgent?: string | null
}

export async function recordAuditEvent(
  input: AuditEventInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const client = getServiceRoleClient()
    const payload = {
      event_type: input.eventType,
      workspace_id: input.workspaceId ?? null,
      actor_user_id: input.actorUserId ?? null,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      metadata: input.metadata ?? null,
      actor_ip: input.actorIp ?? null,
      actor_user_agent: input.actorUserAgent ?? null,
    }
    const { data, error } = await client.from('audit_event').insert(payload).select('id').single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, id: data?.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function recordAuditEventOrThrow(input: AuditEventInput): Promise<string> {
  const result = await recordAuditEvent(input)
  if (!result.ok || !result.id) {
    throw new Error('audit_event_write_failed')
  }
  return result.id
}
